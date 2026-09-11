'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import {
  SignInButton,
  SignOutButton,
  SignUpButton,
} from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Camera,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Download,
  Filter,
  Home,
  IndianRupee,
  Laptop,
  LockKeyhole,
  LogOut,
  Plus,
  Printer,
  QrCode,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  Wrench,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useViewerContext } from '@/components/providers';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getServiceErrorMessage,
  getDeviceScore,
  getDeviceTimeline,
  getDevicesForUser,
  getPublicPassportTimeline,
  getRecentVisibleDevices,
  lookupDevice,
  recalculateDeviceScore,
  registerDevice,
  submitRepairRecord,
  verifyOtpAndApprove,
} from '@/src/lib/services';
import type {
  ComponentName,
  Device,
  DeviceScore,
  DeviceTimeline,
  DeviceType,
  PartType,
  RepairEventWithParts,
  ScoreBreakdown,
} from '@/src/types/database';

type Viewer = ReturnType<typeof useViewerContext>;
type DeviceFilter = 'all' | 'phone' | 'laptop';
type ActivityGroup = 'Today' | 'This week' | 'Earlier';

const navItems = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Devices', href: '/devices', icon: Smartphone },
  { label: 'Scan', href: '/scan', icon: QrCode, featured: true },
  { label: 'Activity', href: '/activity', icon: Activity },
  { label: 'Account', href: '/account', icon: CircleUserRound },
];

const componentOptions: Record<DeviceType, ComponentName[]> = {
  phone: [
    'battery',
    'display',
    'charging_assembly',
    'motherboard',
    'camera',
    'speaker',
    'back_panel',
  ],
  laptop: [
    'battery',
    'display',
    'keyboard',
    'storage',
    'memory',
    'cooling_system',
    'charging_port',
  ],
};

const partTypes: PartType[] = [
  'oem',
  'compatible',
  'refurbished',
  'customer_provided',
];

const scoreFactors: {
  key: keyof ScoreBreakdown;
  label: string;
  weight: number;
  note: string;
}[] = [
  {
    key: 'deviceAge',
    label: 'Device age',
    weight: 15,
    note: 'Newer devices carry less age risk.',
  },
  {
    key: 'repairFrequency',
    label: 'Repair frequency',
    weight: 35,
    note: 'Fewer approved service events improve confidence.',
  },
  {
    key: 'recurringFaults',
    label: 'Recurring faults',
    weight: 30,
    note: 'Repeated symptoms reduce buyer confidence.',
  },
  {
    key: 'criticalComponentHistory',
    label: 'Replaced components',
    weight: 20,
    note: 'Board, display, battery, and storage history matter most.',
  },
];

const audienceTabs = [
  {
    label: 'YOUR DEVICE',
    title: "Don't explain the last repair from memory.",
    body: 'Open previous repairs. Review replaced parts and share the history when selling.',
    cta: 'Register device',
    href: '/register',
  },
  {
    label: 'FOR TECHNICIANS',
    title: 'Know what came before. Show what you fixed.',
    body: 'Review previous repair records. Document replaced parts. Give customers a clear record of your work.',
    cta: 'Scan device QR',
    href: '/scan',
  },
  {
    label: 'BUYING USED',
    title: "A clean screen doesn't tell you what's been repaired.",
    body: 'See recorded part replacements. Look for repeated faults. Ask better questions before buying.',
    cta: 'Check device history',
    href: '/scan',
  },
];

export function LogoMark({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <img
        src="/device-dna-logo.jpeg"
        alt="Device DNA"
        className={`${compact ? 'h-10 w-10' : 'h-12 w-12'} rounded-xl border border-white/10 object-cover shadow-lg`}
      />
      {!compact && (
        <span>
          <span className={`block text-sm font-black uppercase tracking-[0.16em] ${light ? 'text-white' : 'text-device-ink'}`}>
            Device DNA
          </span>
          <span className={light ? 'block text-xs text-white/58' : 'block text-xs text-device-slate'}>
            Permanent device passport
          </span>
        </span>
      )}
    </Link>
  );
}

function useViewer(): Viewer {
  return useViewerContext();
}

export function AppShell({ children, publicMode = false }: { children: React.ReactNode; publicMode?: boolean }) {
  return (
    <div className="min-h-screen overflow-hidden bg-[#050712] text-white">
      <div className="fixed inset-0 -z-10 bg-device-midnight" />
      <div className="fixed inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_center,rgba(39,100,255,0.12),transparent_62%)]" />
      {!publicMode && <DesktopRail />}
      <main className={`mx-auto min-h-screen w-full max-w-[1440px] px-4 pb-28 pt-5 ${publicMode ? 'md:px-6' : 'md:pl-28 md:pr-6 md:pt-6'}`}>
        {children}
      </main>
      {!publicMode && <BottomNav />}
    </div>
  );
}

function DesktopRail() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-4 top-4 z-40 hidden h-[calc(100vh-32px)] w-20 rounded-2xl border border-white/10 bg-white/[0.06] p-3 shadow-2xl shadow-black/30 backdrop-blur-2xl md:block">
      <div className="flex h-full flex-col items-center gap-5">
        <LogoMark compact light />
        <nav className="flex flex-1 flex-col items-center justify-center gap-3">
          {navItems.map((item) => (
            <RailItem key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
      </div>
    </aside>
  );
}

function RailItem({ item, active }: { item: (typeof navItems)[number]; active: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={item.label}
      className={`grid h-14 w-14 place-items-center rounded-xl border transition ${
        item.featured
          ? 'border-device-blue bg-device-blue text-white shadow-lg shadow-device-blue/20'
          : active
            ? 'border-white/20 bg-white/14 text-white'
            : 'border-transparent text-white/52 hover:border-white/10 hover:bg-white/[0.08] hover:text-white'
      }`}
    >
      <Icon size={21} />
    </Link>
  );
}

function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-4 left-1/2 z-50 grid h-[78px] w-[calc(100%-24px)] max-w-md -translate-x-1/2 grid-cols-5 items-center rounded-full border border-white/12 bg-[#0A1020]/78 px-2 shadow-2xl shadow-black/40 backdrop-blur-2xl md:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-bold text-white/52"
          >
            <span
              className={`grid place-items-center rounded-full ${
                item.featured
                  ? '-mt-10 h-[66px] w-[66px] border-[6px] border-[#050712] bg-device-blue text-white shadow-xl shadow-device-blue/25'
                  : `h-9 w-9 ${active ? 'bg-white/14 text-white' : ''}`
              }`}
            >
              <Icon size={item.featured ? 25 : 19} />
            </span>
            <span className={active ? 'text-white' : ''}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

export function HomePage() {
  const viewer = useViewer();

  return (
    <AppShell>
      <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/20 backdrop-blur-xl md:p-8">
        <div className="flex items-center justify-between gap-4">
          <LogoMark light />
          <AuthCluster viewer={viewer} />
        </div>
        <div className="grid gap-8 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34 }}
          >
            <SectionKicker>Device DNA</SectionKicker>
            <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white md:text-7xl">
              The complete history of your device.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/68">
              Register a phone or laptop, print its QR passport, let technicians add pending repair records, then approve them with OTP.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <PrimaryButton href="/register">
                Register device <ArrowRight size={18} />
              </PrimaryButton>
              <GlassButton href="/scan">
                Scan QR <QrCode size={18} />
              </GlassButton>
            </div>
            <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-white/46">
              For phones and laptops
            </p>
          </motion.div>
          <div className="grid gap-3 md:grid-cols-2">
            <StepCard index="01" icon={<Smartphone />} title="Register identity" body="Add brand, model, serial or IMEI, purchase date, and device type." />
            <StepCard index="02" icon={<QrCode />} title="Create QR passport" body="Download or print a public link that opens the device history directly." />
            <StepCard index="03" icon={<Wrench />} title="Log repair" body="Technicians submit pending repair records with parts, cost, and service notes." />
            <StepCard index="04" icon={<ShieldCheck />} title="Approve by OTP" body="Owner confirms the repair before it becomes public history." />
          </div>
        </div>
      </section>
      <FirstLoginGuide />
      <TrustLimits />
    </AppShell>
  );
}

function StepCard({ index, icon, title, body }: { index: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
      <div className="flex items-center justify-between">
        <IconTile tone="blue">{icon}</IconTile>
        <span className="font-mono text-xs font-black text-white/36">{index}</span>
      </div>
      <h2 className="mt-4 text-xl font-black text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-white/60">{body}</p>
    </div>
  );
}

function AuthCluster({ viewer }: { viewer: Viewer }) {
  if (!viewer.configured) return null;
  if (!viewer.ready) return null;

  if (viewer.signedIn) {
    return (
      <Link href="/account" className="hidden items-center gap-3 rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-sm font-bold text-white backdrop-blur-xl md:flex">
        {viewer.imageUrl ? <img src={viewer.imageUrl} alt="" className="h-7 w-7 rounded-full" /> : <CircleUserRound size={18} />}
        {viewer.name}
      </Link>
    );
  }

  return (
    <div className="hidden gap-2 md:flex">
      <SignInButton mode="modal">
        <button className="min-h-11 rounded-full border border-white/12 bg-white/[0.06] px-5 text-sm font-black text-white backdrop-blur-xl">
          Sign in
        </button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button className="min-h-11 rounded-full bg-device-blue px-5 text-sm font-black text-white shadow-lg shadow-device-blue/20 transition hover:bg-device-cobalt">
          Get started
        </button>
      </SignUpButton>
    </div>
  );
}

function QuickTile({ icon, title, body, tone }: { icon: React.ReactNode; title: string; body: string; tone: 'blue' | 'cyan' | 'green' | 'amber' }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-xl">
      <IconTile tone={tone}>{icon}</IconTile>
      <h3 className="mt-4 text-xl font-black text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/60">{body}</p>
    </div>
  );
}

function RoleCard({ title, body, href }: { title: string; body: string; href: string }) {
  return (
    <Link href={href} className="group rounded-2xl border border-white/10 bg-white/[0.07] p-4 transition hover:border-cyan-300/40 hover:bg-white/[0.1]">
      <h3 className="text-xl font-black text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/60">{body}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-cyan-100">
        Enter <ChevronRight className="transition group-hover:translate-x-1" size={16} />
      </span>
    </Link>
  );
}

function AudienceTabs() {
  const [active, setActive] = useState(0);
  const current = audienceTabs[active];

  return (
    <section className="relative mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-black/30 backdrop-blur-2xl md:p-6">
      <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-device-blue/15 blur-3xl" />
      <div className="relative grid gap-5 lg:grid-cols-[0.42fr_0.58fr] lg:items-stretch">
        <div className="grid gap-2 lg:auto-rows-fr">
          {audienceTabs.map((tab, index) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActive(index)}
              className={`rounded-2xl border p-4 text-left transition ${
                active === index
                  ? 'border-cyan-300/40 bg-cyan-300/10 text-white'
                  : 'border-white/10 bg-black/10 text-white/58 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <span className="text-xs font-black tracking-[0.18em]">{tab.label}</span>
              <span className="mt-3 block text-lg font-black leading-tight">{tab.title}</span>
            </button>
          ))}
        </div>
        <motion.div
          key={current.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="relative flex min-h-[360px] flex-col justify-between rounded-2xl border border-white/10 bg-[#090E1A]/82 p-5 md:p-7"
        >
          <div>
            <p className="text-xs font-black tracking-[0.2em] text-cyan-100/82">{current.label}</p>
            <h2 className="mt-5 max-w-2xl text-4xl font-black leading-tight text-white md:text-6xl">
              {current.title}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-white/64 md:text-lg">
              {current.body}
            </p>
          </div>
          <div className="mt-8">
            <PrimaryButton href={current.href}>
              {current.cta} <ArrowRight size={18} />
            </PrimaryButton>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function TrustLimits() {
  return (
    <section className="mx-auto mt-14 max-w-4xl border-t border-white/10 py-10 md:mt-20">
      <h2 className="text-2xl font-black leading-tight text-white/80 md:text-4xl">
        See the record. Know its limits.
      </h2>
      <p className="mt-5 text-base leading-8 text-white/52">
        Each repair shows who submitted it.
      </p>
      <p className="mt-3 text-sm leading-7 text-white/42 md:text-base">
        Records may be incomplete or inaccurate. A device passport helps you understand the recorded history—it does not replace a physical inspection.
      </p>
    </section>
  );
}

function FirstLoginGuide() {
  return (
    <GlassPanel className="mt-5">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <SectionKicker>First login guide</SectionKicker>
          <h2 className="mt-2 text-3xl font-black text-white">Start by registering your first device.</h2>
          <p className="mt-2 text-sm leading-7 text-white/62">
            Pick phone or laptop, add identity fields, review the permanent
            record notice, then download or print the QR passport.
          </p>
        </div>
        <PrimaryButton href="/register">Register now <ArrowRight size={18} /></PrimaryButton>
      </div>
    </GlassPanel>
  );
}

export function DevicesPage() {
  return <DevicesContent />;
}

function DevicesContent() {
  const viewer = useViewer();
  const [devices, setDevices] = useState<Device[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DeviceFilter>('all');

  useEffect(() => {
    const loader = viewer.id ? getDevicesForUser(viewer.id) : getRecentVisibleDevices();
    loader.then(setDevices).catch(() => setDevices([]));
  }, [viewer.id]);

  const filtered = devices.filter((device) => {
    const matchesFilter = filter === 'all' || device.device_type === filter;
    const haystack = `${device.brand} ${device.model} ${device.serial_imei}`.toLowerCase();
    return matchesFilter && haystack.includes(query.toLowerCase());
  });

  return (
    <AppShell>
      <HeaderBlock
        eyebrow="Devices"
        title="Registered devices"
        description="Search every visible Device DNA record and open its timeline."
        action={<PrimaryButton href="/register"><Plus size={17} /> Register</PrimaryButton>}
      />
      <GlassPanel>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SearchBox value={query} onChange={setQuery} />
          <SegmentedFilter value={filter} onChange={setFilter} />
        </div>
      </GlassPanel>
      <div className="mt-5">
        <DeviceGrid devices={filtered} />
      </div>
    </AppShell>
  );
}

function DeviceGrid({ devices }: { devices: Device[] }) {
  if (!devices.length) {
    return <EmptyGlass title="No devices found" body="Register a device or adjust the search and filter." />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {devices.map((device) => (
        <Link
          key={device.id}
          href={`/devices/${device.id}`}
          className="group rounded-2xl border border-white/10 bg-white/[0.07] p-4 shadow-xl shadow-black/20 backdrop-blur-2xl transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-white/[0.1]"
        >
          <div className="flex items-start justify-between gap-3">
            <IconTile tone={device.device_type === 'phone' ? 'blue' : 'cyan'}>
              {device.device_type === 'phone' ? <Smartphone /> : <Laptop />}
            </IconTile>
            <ChevronRight className="text-white/36 transition group-hover:translate-x-1 group-hover:text-white" />
          </div>
          <h3 className="mt-5 truncate text-2xl font-black text-white">{device.brand} {device.model}</h3>
          <p className="mt-2 truncate font-mono text-xs text-white/48">{device.serial_imei}</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <MiniMetric label="Type" value={device.device_type} />
            <MiniMetric label="Registered" value={formatDate(device.created_at)} />
          </div>
        </Link>
      ))}
    </div>
  );
}

export function RegisterPage() {
  return (
    <AuthGate>
      <RegisterContent />
    </AuthGate>
  );
}

function RegisterContent() {
  const viewer = useViewer();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<DeviceType>('phone');
  const [created, setCreated] = useState<Device | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    brand: '',
    model: '',
    serialImei: '',
    processor: '',
    ram: '',
    storage: '',
    purchaseDate: '',
  });

  const specs = useMemo(() => {
    const result: Record<string, string> = {};
    if (form.processor && type === 'laptop') result.processor = form.processor;
    if (form.ram) result.ram = form.ram;
    if (form.storage) result.storage = form.storage;
    return result;
  }, [form, type]);

  async function submit() {
    if (!viewer.id) return;
    if (!form.brand.trim() || !form.model.trim() || !form.serialImei.trim()) {
      setError('Brand, model, and serial/IMEI are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const device = await registerDevice({
        owner_id: viewer.id,
        device_type: type,
        brand: form.brand.trim(),
        model: form.model.trim(),
        serial_imei: form.serialImei.trim(),
        specs,
        purchase_date: form.purchaseDate || null,
      });
      setCreated(device);
      setStep(3);
    } catch (error) {
      setError(getRegistrationErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <HeaderBlock
        eyebrow="Registration"
        title="Create a permanent Device DNA."
        description="Four focused steps: Type, Identity, Review, and QR Success."
      />
      <StepRail labels={['Type', 'Identity', 'Review', 'Success']} active={step} />
      <GlassPanel>
        {step === 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <TypeCard active={type === 'phone'} icon={<Smartphone />} title="Phone" onClick={() => setType('phone')} />
            <TypeCard active={type === 'laptop'} icon={<Laptop />} title="Laptop" onClick={() => setType('laptop')} />
          </div>
        )}
        {step === 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Brand"><Input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} /></Field>
            <Field label="Model"><Input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} /></Field>
            <Field label={type === 'phone' ? 'IMEI' : 'Serial number'}><Input value={form.serialImei} onChange={(event) => setForm({ ...form, serialImei: event.target.value })} /></Field>
            <Field label="Purchase date"><Input type="date" value={form.purchaseDate} onChange={(event) => setForm({ ...form, purchaseDate: event.target.value })} /></Field>
            {type === 'laptop' && <Field label="Processor"><Input value={form.processor} onChange={(event) => setForm({ ...form, processor: event.target.value })} /></Field>}
            <Field label="RAM"><Input value={form.ram} onChange={(event) => setForm({ ...form, ram: event.target.value })} /></Field>
            <Field label="Storage"><Input value={form.storage} onChange={(event) => setForm({ ...form, storage: event.target.value })} /></Field>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <AlertGlass title="Cannot be silently changed">
              Device type, brand, model, and serial/IMEI become the permanent identity base. Future corrections must be added visibly rather than hidden edits.
            </AlertGlass>
            <div className="grid gap-3 md:grid-cols-3">
              <MiniMetric label="Type" value={type} />
              <MiniMetric label="Device" value={`${form.brand || '-'} ${form.model || ''}`} />
              <MiniMetric label="Identity" value={form.serialImei || '-'} />
            </div>
            {error && <p className="text-sm font-black text-red-300">{error}</p>}
          </div>
        )}
        {step === 3 && created && (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div>
              <IconTile tone="green"><BadgeCheck /></IconTile>
              <h2 className="mt-5 text-4xl font-black text-white">QR passport ready.</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/62">
                {created.brand} {created.model} has a Device DNA public passport.
                Download or print the QR for service counters and resale.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <PrimaryButton onClick={() => router.push(`/devices/${created.id}`)}>Open timeline</PrimaryButton>
                <GlassButton href="/register">Register another</GlassButton>
              </div>
            </div>
            <QrGlass value={passportUrl(created.id)} />
          </div>
        )}
        {step < 3 && (
          <div className="mt-6 flex flex-col gap-3 md:flex-row md:justify-between">
            <GlassButton disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>Back</GlassButton>
            {step === 2 ? (
              <PrimaryButton disabled={busy} onClick={submit}>{busy ? 'Creating...' : 'Create Device DNA'}</PrimaryButton>
            ) : (
              <PrimaryButton onClick={() => setStep(step + 1)}>Continue</PrimaryButton>
            )}
          </div>
        )}
      </GlassPanel>
    </AppShell>
  );
}

export function DevicePage() {
  return <DeviceContent />;
}

function DeviceContent() {
  const params = useParams<{ id: string }>();
  const viewer = useViewer();
  const [timeline, setTimeline] = useState<DeviceTimeline | null | undefined>(undefined);
  const [score, setScore] = useState<DeviceScore | null>(null);
  const [otp, setOtp] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [scoreBusy, setScoreBusy] = useState(false);

  useEffect(() => {
    loadDevice(params.id, setTimeline, setScore);
  }, [params.id]);

  async function approve(repairId: string) {
    const code = otp[repairId]?.trim();
    if (!code || code.length !== 6) {
      setNotice('Enter the 6-digit OTP from the approval email.');
      return;
    }
    const result = await verifyOtpAndApprove(repairId, code);
    if (!result.approved) {
      setNotice('OTP was not accepted. Check the code and expiry.');
      return;
    }
    setNotice('Approved. This repair is now part of the permanent public history.');
    await recalculateDeviceScore(params.id).catch(() => null);
    await loadDevice(params.id, setTimeline, setScore);
  }

  async function refreshScore() {
    setScoreBusy(true);
    setNotice('');
    try {
      const nextScore = await recalculateDeviceScore(params.id);
      setScore(nextScore);
      setNotice(nextScore ? 'AI score and summary refreshed.' : 'Score could not be generated yet. Add approved repair history or check edge function secrets.');
    } catch (error) {
      setNotice(`Score refresh failed: ${getServiceErrorMessage(error)}`);
    } finally {
      setScoreBusy(false);
    }
  }

  if (timeline === undefined) return <AppShell><LoadingGlass title="Loading device timeline" /></AppShell>;
  if (!timeline) return <AppShell><EmptyGlass title="Device not found" body="Scan again or check the Device DNA ID." /></AppShell>;

  const isOwner = viewer.id === timeline.owner_id;
  const canAddRepair = Boolean(viewer.signedIn);

  return (
    <AppShell>
      <DeviceHero device={timeline} score={score} />
      <div className="mt-6 grid gap-5 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="space-y-5">
          <ScoreSuite score={score} />
          <QrGlass value={passportUrl(timeline.id)} />
        </div>
        <section>
          <HeaderBlock
            eyebrow="Timeline"
            title="Locked repair history"
            description="Pending repairs are waiting on owner OTP and do not appear on the public passport."
            action={
              <div className="flex flex-wrap gap-2">
                <GlassButton disabled={scoreBusy} onClick={refreshScore}>
                  <Sparkles size={17} /> {scoreBusy ? 'Scoring...' : 'Refresh AI score'}
                </GlassButton>
                {canAddRepair ? <PrimaryButton href={`/devices/${timeline.id}/repair`}><Wrench size={17} /> Add repair</PrimaryButton> : null}
              </div>
            }
          />
          {notice && <AlertGlass title="Approval update">{notice}</AlertGlass>}
          <RepairTimeline
            repairs={timeline.repair_events}
            isOwner={isOwner}
            otp={otp}
            setOtp={setOtp}
            onApprove={approve}
          />
        </section>
      </div>
    </AppShell>
  );
}

async function loadDevice(
  id: string,
  setTimeline: (value: DeviceTimeline | null) => void,
  setScore: (value: DeviceScore | null) => void,
) {
  try {
    const timeline = await getDeviceTimeline(id);
    const score = timeline
      ? (await getDeviceScore(id)) ?? (await recalculateDeviceScore(id).catch(() => null))
      : null;
    setTimeline(timeline);
    setScore(score);
  } catch {
    setTimeline(null);
    setScore(null);
  }
}

function DeviceHero({ device, score }: { device: DeviceTimeline; score: DeviceScore | null }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl md:p-7">
      <div className="absolute right-10 top-0 h-56 w-56 rounded-full bg-device-blue/20 blur-3xl" />
      <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <SectionKicker>Device log</SectionKicker>
          <h1 className="mt-3 text-4xl font-black text-white md:text-6xl">{device.brand} {device.model}</h1>
          <p className="mt-3 font-mono text-sm text-white/50">{device.serial_imei} · {formatDate(device.created_at)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <HeroStat label="Health" value={score ? `${score.health_score}/100` : 'No score'} />
          <HeroStat label="Market" value={formatCurrency(score?.market_value_estimate)} />
        </div>
      </div>
    </section>
  );
}

function ScoreSuite({ score }: { score: DeviceScore | null }) {
  return (
    <div className="space-y-5">
      <GlassPanel>
        <div className="flex items-center justify-between gap-3">
          <div>
            <SectionKicker>Health Score</SectionKicker>
            <p className="mt-3 text-6xl font-black text-white">{score?.health_score ?? '--'}<span className="text-xl text-white/38">/100</span></p>
          </div>
          <IconTile tone="blue"><ShieldCheck /></IconTile>
        </div>
        <div className="mt-6 space-y-4">
          {scoreFactors.map((factor) => (
            <ScoreRow key={factor.key} factor={factor} value={score?.score_breakdown?.[factor.key] ?? 0} />
          ))}
        </div>
      </GlassPanel>
      <GlassPanel>
        <div className="flex items-center gap-3">
          <IconTile tone="cyan"><IndianRupee /></IconTile>
          <div>
            <SectionKicker>AI Market Value Estimate</SectionKicker>
            <h2 className="mt-2 text-3xl font-black text-white">{formatCurrency(score?.market_value_estimate)}</h2>
          </div>
        </div>
        <p className="mt-4 text-sm leading-7 text-white/62">
          {score?.market_value_summary ?? 'Not enough approved data yet for a credible estimate.'}
        </p>
      </GlassPanel>
    </div>
  );
}

function ScoreRow({ factor, value }: { factor: (typeof scoreFactors)[number]; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-black text-white">{factor.label} <span className="font-medium text-white/38">({factor.weight}%)</span></span>
        <span className="font-mono text-cyan-100">{value}/100</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-device-blue" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <p className="mt-1 text-xs text-white/40">{factor.note}</p>
    </div>
  );
}

function RepairTimeline({
  repairs,
  isOwner,
  otp,
  setOtp,
  onApprove,
  publicOnly = false,
}: {
  repairs: RepairEventWithParts[];
  isOwner: boolean;
  otp: Record<string, string>;
  setOtp: (value: Record<string, string>) => void;
  onApprove: (repairId: string) => void;
  publicOnly?: boolean;
}) {
  if (!repairs.length) return <EmptyGlass title="No repairs logged yet" body={publicOnly ? 'No approved public records yet.' : 'A technician can add the first pending record after scanning this device.'} />;

  return (
    <div className="space-y-4">
      {repairs.map((repair) => {
        const pending = repair.status === 'pending';
        return (
          <article key={repair.id} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 shadow-xl shadow-black/20 backdrop-blur-2xl">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={pending ? 'pending' : 'approved'}>{pending ? 'Pending owner approval' : 'Approved'}</Badge>
                  <Badge tone="locked">{pending ? 'Locked, waiting' : 'Permanent public history'}</Badge>
                </div>
                <h3 className="mt-4 text-2xl font-black text-white">{repair.symptom}</h3>
                <p className="mt-1 text-sm text-white/50">{formatDateTime(repair.created_at)} · {repair.profiles?.display_name ?? 'Verified technician'}</p>
              </div>
              <p className="text-lg font-black text-white">{formatCurrency(repair.cost)}</p>
            </div>
            <dl className="mt-5 grid gap-3 text-sm md:grid-cols-3">
              <Info label="Diagnosis" value={repair.diagnosis ?? 'Not provided'} />
              <Info label="Action" value={repair.action_taken} />
              <Info label="Parts" value={repair.parts.length ? repair.parts.map((part) => pretty(part.component_name)).join(', ') : 'No replacement'} />
            </dl>
            {pending && !publicOnly && (
              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                <p className="flex items-center gap-2 text-sm font-black text-amber-100">
                  <LockKeyhole size={16} />
                  Locked but waiting. Not visible on the public passport until owner OTP approval.
                </p>
                {isOwner && (
                  <div className="mt-3 flex flex-col gap-2 md:flex-row">
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit OTP"
                      value={otp[repair.id] ?? ''}
                      onChange={(event) => setOtp({ ...otp, [repair.id]: event.target.value.replace(/\D/g, '').slice(0, 6) })}
                    />
                    <PrimaryButton onClick={() => onApprove(repair.id)}>Approve</PrimaryButton>
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function RepairSubmissionPage() {
  return (
    <AuthGate>
      <RepairSubmissionContent />
    </AuthGate>
  );
}

function RepairSubmissionContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const viewer = useViewer();
  const [timeline, setTimeline] = useState<DeviceTimeline | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    symptom: '',
    diagnosis: '',
    actionTaken: '',
    componentName: 'battery' as ComponentName,
    partType: 'oem' as PartType,
    partNumber: '',
    supplier: '',
    partCost: '',
    warrantyDays: '90',
    serviceCost: '',
  });

  useEffect(() => {
    getDeviceTimeline(params.id).then(setTimeline).catch(() => setTimeline(null));
  }, [params.id]);

  async function submit() {
    if (!viewer.id) {
      setError('Sign in to add repair records.');
      return;
    }
    if (!form.symptom.trim() || !form.actionTaken.trim()) {
      setError('Symptoms and action taken are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await submitRepairRecord({
        deviceId: params.id,
        technicianId: viewer.id,
        symptom: form.symptom.trim(),
        diagnosis: form.diagnosis.trim() || null,
        actionTaken: form.actionTaken.trim(),
        cost: numberOrNull(form.serviceCost),
        parts: form.partNumber || form.supplier || Number(form.partCost) > 0
          ? [{
              componentName: form.componentName,
              partType: form.partType,
              partNumber: form.partNumber || null,
              supplier: form.supplier || null,
              cost: numberOrNull(form.partCost),
              warrantyDays: Number(form.warrantyDays) || 0,
            }]
          : [],
      });
      router.push(`/devices/${params.id}`);
    } catch (error) {
      setError(getServiceErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <HeaderBlock
        eyebrow="Technician record"
        title="Submit pending repair"
        description={timeline ? `${timeline.brand} ${timeline.model} · owner OTP email is sent after submission.` : 'Loading device...'}
      />
      <GlassPanel>
        <AlertGlass title="Approval required">
          This creates a locked pending record. The owner must approve with OTP before it becomes public.
        </AlertGlass>
        <div className="grid gap-4">
          <Field label="Symptoms"><Textarea value={form.symptom} onChange={(event) => setForm({ ...form, symptom: event.target.value })} placeholder="Example: Phone charges only at an angle; customer reports intermittent fast charging." /></Field>
          <Field label="Diagnosis"><Textarea value={form.diagnosis} onChange={(event) => setForm({ ...form, diagnosis: event.target.value })} placeholder="Example: Charging connector pins worn; no motherboard damage found during inspection." /></Field>
          <Field label="Action taken"><Textarea value={form.actionTaken} onChange={(event) => setForm({ ...form, actionTaken: event.target.value })} placeholder="Example: Replaced charging assembly, cleaned connector path, tested fast charging and data transfer." /></Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Component">
              <Select value={form.componentName} onChange={(event) => setForm({ ...form, componentName: event.target.value as ComponentName })}>
                {componentOptions[timeline?.device_type ?? 'phone'].map((option) => <option key={option} value={option}>{pretty(option)}</option>)}
              </Select>
            </Field>
            <Field label="Part type">
              <Select value={form.partType} onChange={(event) => setForm({ ...form, partType: event.target.value as PartType })}>
                {partTypes.map((option) => <option key={option} value={option}>{pretty(option)}</option>)}
              </Select>
            </Field>
            <Field label="Part number"><Input value={form.partNumber} onChange={(event) => setForm({ ...form, partNumber: event.target.value })} placeholder="Example: GH96-16522A or supplier SKU" /></Field>
            <Field label="Supplier"><Input value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} placeholder="Example: Metro Device Care stock" /></Field>
            <Field label="Part cost"><Input type="number" min="0" value={form.partCost} onChange={(event) => setForm({ ...form, partCost: event.target.value })} placeholder="Example: 1450" /></Field>
            <Field label="Warranty days"><Input type="number" min="0" value={form.warrantyDays} onChange={(event) => setForm({ ...form, warrantyDays: event.target.value })} placeholder="Example: 90" /></Field>
            <Field label="Service cost"><Input type="number" min="0" value={form.serviceCost} onChange={(event) => setForm({ ...form, serviceCost: event.target.value })} placeholder="Example: 2300" /></Field>
          </div>
          {error && <p className="text-sm font-black text-red-300">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <GlassButton href={`/devices/${params.id}`}>Cancel</GlassButton>
            <PrimaryButton disabled={busy} onClick={submit}>{busy ? 'Submitting...' : 'Submit pending record'}</PrimaryButton>
          </div>
        </div>
      </GlassPanel>
    </AppShell>
  );
}

export function ScanPage() {
  return <ScanContent />;
}

function ScanContent() {
  const router = useRouter();
  const scannerRef = useRef<Html5ScannerInstance | null>(null);
  const scannerRunningRef = useRef(false);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<'scanner' | 'found' | 'missing' | 'invalid' | 'camera-off'>('scanner');
  const [scannerError, setScannerError] = useState('');

  async function find(value = query) {
    const parsed = parseDeviceCode(value);
    if (!parsed) {
      setState('invalid');
      return;
    }
    const device = await lookupDevice(parsed).catch(() => null);
    if (!device) {
      setState('missing');
      return;
    }
    setState('found');
    router.push(`/devices/${device.id}`);
  }

  async function clearScanner() {
    const scanner = scannerRef.current;
    scannerRef.current = null;

    if (scanner) {
      try {
        if (scannerRunningRef.current) {
          await scanner.stop();
        }
      } catch {
        // Camera was already stopped.
      } finally {
        scannerRunningRef.current = false;
        scanner.clear();
      }
    }
  }

  async function scanUploadedQr(file: File | undefined) {
    if (!file) return;

    try {
      await clearScanner();
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('device-dna-upload-scanner') as Html5ScannerInstance;
      const decodedText = await scanner.scanFile(file, true);
      scanner.clear();
      await find(decodedText);
    } catch (error) {
      setState('invalid');
      setScannerError(`Could not read that QR image. ${getServiceErrorMessage(error)}`);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadScanner() {
      setScannerError('');

      try {
        await clearScanner();
        const { Html5Qrcode } = await import('html5-qrcode');

        if (cancelled) {
          return;
        }

        const scanner = new Html5Qrcode('device-dna-scanner') as Html5ScannerInstance;
        scannerRef.current = scanner;
        const config = {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1,
        };
        const onSuccess = async (decodedText: string) => {
          await clearScanner();
          await find(decodedText);
        };

        try {
          await scanner.start(
            { facingMode: { exact: 'environment' } },
            config,
            onSuccess,
            () => undefined,
          );
        } catch {
          try {
            await scanner.start(
              { facingMode: 'environment' },
              config,
              onSuccess,
              () => undefined,
            );
          } catch {
            const cameras = await Html5Qrcode.getCameras();
            const firstCameraId = cameras[0]?.id;

            if (!firstCameraId) {
              throw new Error('No camera found');
            }

            await scanner.start(firstCameraId, config, onSuccess, () => undefined);
          }
        }

        scannerRunningRef.current = true;
        setState('scanner');
      } catch (error) {
        setState('camera-off');
        setScannerError(
          `Camera could not open. Use manual lookup or upload a QR image. ${getServiceErrorMessage(error)}`,
        );
      }
    }

    void loadScanner();

    return () => {
      cancelled = true;
      void clearScanner();
    };
  }, []);

  return (
    <AppShell>
      <HeaderBlock
        eyebrow="Scan"
        title="Scan a Device DNA passport."
        description="Use the camera, upload a QR image, or enter a Device DNA ID manually. Results open as public read-only passports."
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_390px]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-black/30 backdrop-blur-2xl md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <LogoMark compact light />
            <Badge tone={state === 'found' ? 'approved' : state === 'missing' ? 'danger' : 'neutral'}>{state}</Badge>
          </div>
          <div className="normal-qr-scanner rounded-xl border border-white/10 bg-white p-3 text-device-midnight">
            <div id="device-dna-scanner" />
            <div id="device-dna-upload-scanner" className="hidden" />
          </div>
          {scannerError && <p className="mt-3 text-sm font-bold text-amber-100">{scannerError}</p>}
        </section>
        <GlassPanel>
          <h2 className="text-2xl font-black text-white">Manual lookup</h2>
          <p className="mt-2 text-sm leading-7 text-white/60">Paste a public passport URL, device ID, serial, or IMEI.</p>
          <div className="mt-5 space-y-3">
            <Field label="Device DNA ID or passport link">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Paste a QR link or enter a serial/IMEI"
              />
            </Field>
            {state === 'missing' && <p className="text-sm font-bold text-red-300">No device found.</p>}
            {state === 'invalid' && <p className="text-sm font-bold text-red-300">Enter a valid code or link.</p>}
            {state === 'camera-off' && <p className="text-sm font-bold text-amber-100">Camera is unavailable. Manual lookup still works.</p>}
            <PrimaryButton onClick={() => find()}>Find device</PrimaryButton>
            <label className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-5 text-sm font-black text-white shadow-lg shadow-black/10 backdrop-blur-xl transition hover:bg-white/[0.11]">
              <Upload size={16} />
              Upload QR image
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => void scanUploadedQr(event.target.files?.[0])}
              />
            </label>
          </div>
        </GlassPanel>
      </div>
    </AppShell>
  );
}

type Html5ScannerInstance = {
  start: (
    cameraConfig: string | MediaTrackConstraints,
    configuration: {
      fps: number;
      qrbox: { width: number; height: number };
      aspectRatio: number;
    },
    qrCodeSuccessCallback: (decodedText: string) => void,
    qrCodeErrorCallback?: () => void,
  ) => Promise<unknown>;
  stop: () => Promise<unknown>;
  clear: () => void;
  scanFile: (imageFile: File, showImage?: boolean) => Promise<string>;
};

export function ActivityPage() {
  return (
    <AuthGate>
      <ActivityContent />
    </AuthGate>
  );
}

function ActivityContent() {
  const viewer = useViewer();
  const [groups, setGroups] = useState<Record<ActivityGroup, RepairEventWithParts[]>>({
    Today: [],
    'This week': [],
    Earlier: [],
  });

  useEffect(() => {
    if (!viewer.id) return;
    loadActivity(viewer.id).then(setGroups).catch(() => undefined);
  }, [viewer.id]);

  return (
    <AppShell>
      <HeaderBlock eyebrow="Activity" title="Recent history across devices" description="Approval, repair, and score-related timeline events grouped by recency." />
      <div className="space-y-5">
        {(['Today', 'This week', 'Earlier'] as ActivityGroup[]).map((group) => (
          <GlassPanel key={group}>
            <h2 className="text-2xl font-black text-white">{group}</h2>
            <div className="mt-4 space-y-3">
              {groups[group].length ? groups[group].map((repair) => (
                <Link key={repair.id} href={`/devices/${repair.device_id}`} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                  <IconTile tone={repair.status === 'approved' ? 'green' : 'amber'}>{repair.status === 'approved' ? <BadgeCheck /> : <Clock3 />}</IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-white">{repair.symptom}</p>
                    <p className="mt-1 text-sm text-white/50">{repair.status === 'approved' ? 'Approved repair' : 'Pending owner approval'} · {formatDateTime(repair.created_at)}</p>
                  </div>
                </Link>
              )) : <p className="text-sm text-white/45">No activity in this group.</p>}
            </div>
          </GlassPanel>
        ))}
      </div>
    </AppShell>
  );
}

async function loadActivity(userId: string): Promise<Record<ActivityGroup, RepairEventWithParts[]>> {
  const devices = await getDevicesForUser(userId);
  const timelines = await Promise.all(devices.slice(0, 12).map((device) => getDeviceTimeline(device.id)));
  const repairs = timelines
    .filter((timeline): timeline is DeviceTimeline => Boolean(timeline))
    .flatMap((timeline) => timeline.repair_events)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return repairs.reduce<Record<ActivityGroup, RepairEventWithParts[]>>((acc, repair) => {
    acc[groupForDate(repair.created_at)].push(repair);
    return acc;
  }, { Today: [], 'This week': [], Earlier: [] });
}

function groupForDate(value: string): ActivityGroup {
  const age = Date.now() - new Date(value).getTime();
  if (age < 24 * 60 * 60 * 1000) return 'Today';
  if (age < 7 * 24 * 60 * 60 * 1000) return 'This week';
  return 'Earlier';
}

export function AccountPage() {
  return (
    <AuthGate>
      <AccountContent />
    </AuthGate>
  );
}

function AccountContent() {
  const viewer = useViewer();
  return (
    <AppShell>
      <HeaderBlock eyebrow="Account" title="Profile" description="Your Google/Clerk identity used across Device DNA." />
      <GlassPanel>
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          {viewer.imageUrl ? (
            <img src={viewer.imageUrl} alt={viewer.name} className="h-24 w-24 rounded-2xl border border-white/10 object-cover shadow-xl" />
          ) : (
            <div className="grid h-24 w-24 place-items-center rounded-2xl border border-white/10 bg-white/[0.07]"><CircleUserRound size={42} /></div>
          )}
          <div className="flex-1">
            <h2 className="text-4xl font-black text-white">{viewer.name}</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <MiniMetric label="Email" value={viewer.email} normal />
              <MiniMetric label="Phone" value={viewer.phone} normal />
              <MiniMetric label="Access" value="Signed in" />
            </div>
          </div>
          {viewer.configured && (
            <SignOutButton>
              <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-5 text-sm font-black text-white backdrop-blur-xl">
                <LogOut size={17} /> Sign out
              </button>
            </SignOutButton>
          )}
        </div>
      </GlassPanel>
    </AppShell>
  );
}

export function PassportPage() {
  const params = useParams<{ id: string }>();
  const [timeline, setTimeline] = useState<DeviceTimeline | null | undefined>(undefined);
  const [score, setScore] = useState<DeviceScore | null>(null);

  useEffect(() => {
    Promise.all([getPublicPassportTimeline(params.id), getDeviceScore(params.id)])
      .then(([timeline, score]) => {
        setTimeline(timeline);
        setScore(score);
      })
      .catch(() => {
        setTimeline(null);
        setScore(null);
      });
  }, [params.id]);

  if (timeline === undefined) return <AppShell publicMode><LoadingGlass title="Loading passport" /></AppShell>;
  if (!timeline) return <AppShell publicMode><EmptyGlass title="Passport not found" body="Check the QR code or scan again." /></AppShell>;

  return (
    <AppShell publicMode>
      <div className="mb-5 flex items-center justify-between">
        <LogoMark light />
        <GlassButton href="/">Open portal</GlassButton>
      </div>
      <DeviceHero device={timeline} score={score} />
      <div className="mt-6 grid gap-5 xl:grid-cols-[0.88fr_1.12fr]">
        <ScoreSuite score={score} />
        <section>
          <HeaderBlock eyebrow="Public passport" title="Approved history only" description="No owner contact details or pending repair records are shown here." />
          <RepairTimeline repairs={timeline.repair_events} isOwner={false} otp={{}} setOtp={() => undefined} onApprove={() => undefined} publicOnly />
        </section>
      </div>
    </AppShell>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const viewer = useViewer();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (viewer.ready) {
      setTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => setTimedOut(true), 3500);
    return () => window.clearTimeout(timer);
  }, [viewer.ready]);

  if (!viewer.configured) {
    return (
      <AppShell>
        <GlassPanel>
          <h1 className="text-4xl font-black text-white">Clerk is not configured.</h1>
          <p className="mt-3 text-sm leading-7 text-white/62">
            Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to your environment and restart
            Next.js.
          </p>
        </GlassPanel>
      </AppShell>
    );
  }

  if (!viewer.ready && !timedOut) return <AppShell><LoadingGlass title="Checking sign-in" /></AppShell>;

  if (!viewer.signedIn || timedOut) {
    return (
      <AppShell>
        <GlassPanel>
          <SectionKicker>Authentication required</SectionKicker>
          <h1 className="mt-3 text-4xl font-black text-white">Sign in to enter Device DNA.</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-white/62">
            Devices, scanner, activity, and account tabs use Clerk-backed Supabase
            access. Public passports remain read-only.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <SignInButton mode="modal">
              <button className="min-h-12 rounded-full bg-device-blue px-5 text-sm font-black text-white shadow-lg shadow-device-blue/20 transition hover:bg-device-cobalt">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="min-h-12 rounded-full border border-white/10 bg-white/[0.07] px-5 text-sm font-black text-white">
                Create account
              </button>
            </SignUpButton>
          </div>
        </GlassPanel>
      </AppShell>
    );
  }

  return <>{children}</>;
}

function HeaderBlock({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        {eyebrow && <SectionKicker>{eyebrow}</SectionKicker>}
        <h1 className="mt-2 max-w-4xl text-4xl font-black leading-tight text-white md:text-6xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-sm leading-7 text-white/58 md:text-base">{description}</p>}
      </div>
      {action}
    </header>
  );
}

function GlassPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-black/20 backdrop-blur-2xl md:p-5 ${className}`}>{children}</section>;
}

function SectionKicker({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/82">{children}</p>;
}

function PrimaryButton({ href, children, disabled = false, onClick }: { href?: string; children: React.ReactNode; disabled?: boolean; onClick?: () => void }) {
  const className = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-device-blue px-5 text-sm font-black text-white shadow-lg shadow-device-blue/20 transition hover:bg-device-cobalt disabled:cursor-not-allowed disabled:opacity-50';
  if (href) return <Link href={href} className={className}>{children}</Link>;
  return <button type="button" disabled={disabled} onClick={onClick} className={className}>{children}</button>;
}

function GlassButton({ href, children, disabled = false, onClick }: { href?: string; children: React.ReactNode; disabled?: boolean; onClick?: () => void }) {
  const className = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-5 text-sm font-black text-white shadow-lg shadow-black/10 backdrop-blur-xl transition hover:bg-white/[0.11] disabled:cursor-not-allowed disabled:opacity-50';
  if (href) return <Link href={href} className={className}>{children}</Link>;
  return <button type="button" disabled={disabled} onClick={onClick} className={className}>{children}</button>;
}

function IconTile({ children, tone }: { children: React.ReactNode; tone: 'blue' | 'cyan' | 'green' | 'amber' }) {
  const tones = {
    blue: 'border-device-blue/25 bg-device-blue/18 text-[#7EA2FF]',
    cyan: 'border-device-cyan/25 bg-device-cyan/14 text-[#8DDBFF]',
    green: 'border-emerald-300/25 bg-emerald-300/12 text-emerald-200',
    amber: 'border-amber-300/25 bg-amber-300/12 text-amber-200',
  };
  return <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl border ${tones[tone]}`}>{children}</div>;
}

function MiniMetric({ label, value, normal = false }: { label: string; value: React.ReactNode; normal?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
      <p className="text-xs font-bold text-white/42">{label}</p>
      <p className={`mt-1 truncate text-sm font-black text-white ${normal ? 'normal-case' : 'capitalize'}`}>{value}</p>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-36 rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur-xl">
      <p className="text-xs font-bold text-white/45">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'approved' | 'pending' | 'locked' | 'neutral' | 'danger' }) {
  const tones = {
    approved: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    pending: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    locked: 'border-white/12 bg-white/[0.06] text-white/62',
    neutral: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
    danger: 'border-red-300/20 bg-red-300/10 text-red-100',
  };
  return <span className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-black ${tones[tone]}`}>{children}</span>;
}

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex min-h-12 flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4">
      <Search size={18} className="text-white/42" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search brand, model, serial..." className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/32" />
    </label>
  );
}

function SegmentedFilter({ value, onChange }: { value: DeviceFilter; onChange: (value: DeviceFilter) => void }) {
  return (
    <div className="flex rounded-full border border-white/10 bg-white/[0.06] p-1">
      {(['all', 'phone', 'laptop'] as DeviceFilter[]).map((item) => (
        <button key={item} type="button" onClick={() => onChange(item)} className={`min-h-10 rounded-full px-4 text-sm font-black capitalize ${value === item ? 'bg-white text-device-midnight' : 'text-white/58'}`}>
          {item === 'all' ? <span className="inline-flex items-center gap-1"><Filter size={14} /> All</span> : item === 'phone' ? 'Phones' : 'Laptops'}
        </button>
      ))}
    </div>
  );
}

function StepRail({ labels, active }: { labels: string[]; active: number }) {
  return (
    <div className="mb-5 grid rounded-full border border-white/10 bg-white/[0.06] p-1" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
      {labels.map((label, index) => (
        <div key={label} className={`rounded-full px-3 py-3 text-center text-xs font-black ${index <= active ? 'bg-device-blue text-white' : 'text-white/42'}`}>
          {label}
        </div>
      ))}
    </div>
  );
}

function TypeCard({ active, icon, title, onClick }: { active: boolean; icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`min-h-40 rounded-2xl border p-5 text-left transition ${active ? 'border-cyan-300/40 bg-cyan-300/10' : 'border-white/10 bg-white/[0.05] hover:bg-white/[0.08]'}`}>
      <IconTile tone={title === 'Phone' ? 'blue' : 'cyan'}>{icon}</IconTile>
      <span className="mt-5 block text-3xl font-black text-white">{title}</span>
    </button>
  );
}

function QrGlass({ value }: { value: string }) {
  const id = useMemo(() => `qr-${Math.random().toString(36).slice(2)}`, []);

  function download() {
    const svg = document.getElementById(id);
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const image = new Image();
    const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;

    image.onload = () => {
      const canvas = document.createElement('canvas');
      const padding = 32;
      canvas.width = image.width + padding * 2;
      canvas.height = image.height + padding * 2;
      const context = canvas.getContext('2d');

      if (!context) {
        return;
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, padding, padding);

      const anchor = document.createElement('a');
      anchor.href = canvas.toDataURL('image/png');
      anchor.download = 'device-dna-passport-qr.png';
      anchor.click();
    };

    image.src = svgUrl;
  }

  return (
    <GlassPanel>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black text-white">Passport QR</h2>
        <QrCode className="text-cyan-100" />
      </div>
      <div className="mt-4 grid place-items-center rounded-2xl border border-white/10 bg-white p-5">
        <QRCodeSVG id={id} value={value} size={190} bgColor="#ffffff" fgColor="#080B11" />
      </div>
      <p className="mt-3 break-all font-mono text-xs text-white/42">{value}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <GlassButton onClick={download}><Download size={16} /> Download</GlassButton>
        <GlassButton onClick={() => window.print()}><Printer size={16} /> Print</GlassButton>
      </div>
    </GlassPanel>
  );
}

function AlertGlass({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
      <p className="font-black text-cyan-100">{title}</p>
      <p className="mt-1 text-sm leading-7 text-white/68">{children}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-white/80">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.07] px-4 text-sm text-white outline-none placeholder:text-white/32 focus:border-cyan-300/50 ${props.className ?? ''}`} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`min-h-12 w-full rounded-xl border border-white/10 bg-[#0B1020] px-4 text-sm text-white outline-none focus:border-cyan-300/50 ${props.className ?? ''}`} />;
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`min-h-28 w-full rounded-xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm text-white outline-none placeholder:text-white/32 focus:border-cyan-300/50 ${props.className ?? ''}`} />;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-[0.14em] text-white/38">{label}</dt>
      <dd className="mt-1 leading-6 text-white/78">{value}</dd>
    </div>
  );
}

function LoadingGlass({ title }: { title: string }) {
  return (
    <GlassPanel>
      <p className="font-black text-white">{title}</p>
      <div className="mt-4 h-3 w-2/3 animate-pulse rounded-full bg-white/10" />
      <div className="mt-3 h-3 w-1/2 animate-pulse rounded-full bg-white/10" />
    </GlassPanel>
  );
}

function EmptyGlass({ title, body }: { title: string; body?: string }) {
  return (
    <GlassPanel>
      <Sparkles className="text-cyan-100" />
      <h2 className="mt-4 text-2xl font-black text-white">{title}</h2>
      {body && <p className="mt-2 max-w-md text-sm leading-7 text-white/58">{body}</p>}
    </GlassPanel>
  );
}

function parseDeviceCode(value: string) {
  const clean = value.trim();
  if (!clean) return '';
  try {
    const url = new URL(clean);
    const parts = url.pathname.split('/').filter(Boolean);
    return decodeURIComponent(parts[parts.length - 1] ?? '');
  } catch {
    return clean;
  }
}

function passportUrl(deviceId: string) {
  if (typeof window === 'undefined') return `/passport/${deviceId}`;
  return `${window.location.origin}/passport/${deviceId}`;
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pretty(value: string) {
  return value.replace(/_/g, ' ');
}

function getRegistrationErrorMessage(error: unknown) {
  const message = getServiceErrorMessage(error);
  const lower = message.toLowerCase();

  if (lower.includes('duplicate') || lower.includes('unique')) {
    return 'A device with this serial or IMEI already exists.';
  }

  if (lower.includes('row-level security') || lower.includes('violates row-level security')) {
    return 'Supabase blocked registration. Apply the latest profile bootstrap migration so signed-in users can create their own devices.';
  }

  if (lower.includes('jwt') || lower.includes('auth')) {
    return 'Your sign-in session is missing the Supabase JWT. Sign out, sign in again, and confirm the Clerk Supabase JWT template is enabled.';
  }

  return `Could not register this device: ${message}`;
}
