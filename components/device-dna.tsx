'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { SignInButton, SignOutButton, SignUpButton } from '@clerk/clerk-react';
import {
  Activity,
  Camera,
  Check,
  ChevronRight,
  CircleUserRound,
  Clock,
  Download,
  FileText,
  Home,
  Laptop,
  ListChecks,
  Lock,
  Plus,
  QrCode,
  Search,
  Send,
  Shield,
  Smartphone,
  Upload,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useViewerContext } from '@/components/providers';
import { dnaCssVariables, ui } from '@/lib/design-tokens';
import {
  decideRepairAccessRequest,
  formatCurrency,
  formatDate,
  formatDateTime,
  getDeviceScore,
  getDeviceTimeline,
  getDevicesForUser,
  getPublicPassportTimeline,
  getRepairAccessRequests,
  getRepairAccessStatus,
  getServiceErrorMessage,
  lookupDevice,
  registerDevice,
  requestRepairAccess,
  submitRepairRecord,
  updateProfilePhone,
} from '@/src/lib/services';
import type { RepairAccessRequestWithDevice } from '@/src/lib/services';
import type {
  ComponentName,
  Device,
  DeviceScore,
  DeviceTimeline,
  DeviceType,
  PartType,
  RepairEventWithParts,
} from '@/src/types/database';

type Viewer = ReturnType<typeof useViewerContext>;
type DeviceFilter = 'all' | 'phone' | 'laptop';
type AccessState = 'pending' | 'approved' | 'declined' | null | undefined;

const navLinks = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/devices', label: 'Devices', icon: Smartphone },
  { href: '/scan', label: 'Scan', icon: QrCode },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/account', label: 'Profile', icon: User },
] as const;

const componentOptions: Record<DeviceType, ComponentName[]> = {
  phone: ['battery', 'display', 'charging_assembly', 'motherboard', 'camera', 'speaker', 'back_panel'],
  laptop: ['battery', 'display', 'keyboard', 'storage', 'memory', 'motherboard', 'cooling_system', 'charging_port'],
};

const partTypes: PartType[] = ['oem', 'compatible', 'refurbished', 'customer_provided'];

export function LogoMark({
  variant = 'lockup',
}: {
  variant?: 'lockup' | 'wordmark' | 'icon' | 'mark';
}) {
  const assets = {
    lockup: {
      src: '/assets/icons/device-dna-logo-v2.svg',
      className: 'h-11 w-auto',
      alt: 'Device DNA',
    },
    wordmark: {
      src: '/assets/icons/device-dna-wordmark-v2.svg',
      className: 'h-8 w-auto',
      alt: 'Device DNA',
    },
    icon: {
      src: '/assets/icons/device-dna-icon-v2.svg',
      className: 'h-11 w-11',
      alt: 'Device DNA',
    },
    mark: {
      src: '/assets/icons/device-dna-mark-ink.svg',
      className: 'h-7 w-7',
      alt: 'Device DNA',
    },
  }[variant];

  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-3">
      <img src={assets.src} alt={assets.alt} className={assets.className} />
    </Link>
  );
}

function useViewer(): Viewer {
  return useViewerContext();
}

function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className={ui.page} style={dnaCssVariables}>
      <main className="mx-auto min-h-screen w-full max-w-2xl px-5 pb-36 pt-5 md:max-w-5xl md:px-8 md:pb-12">
        {children}
      </main>
    </div>
  );
}

function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className={ui.appPage} style={dnaCssVariables}>
      <main className="mx-auto min-h-screen w-full max-w-5xl px-5 pb-28 pt-5 md:px-8 md:pb-32">
        {children}
      </main>
      <FloatingNav />
    </div>
  );
}

function FloatingNav() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    function onScroll() {
      const nextY = window.scrollY;
      setHidden(nextY > 40 && nextY > lastY.current);
      lastY.current = nextY;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed bottom-4 left-1/2 z-40 grid h-[var(--dna-nav-height)] w-[calc(100%-32px)] max-w-[440px] -translate-x-1/2 grid-cols-5 items-center rounded-[var(--dna-pill-radius)] border border-[var(--dna-border)] bg-[var(--dna-background)] px-4 transition-transform duration-200 ${
        hidden ? 'translate-y-28' : 'translate-y-0'
      }`}
      aria-label="Main navigation"
    >
      {navLinks.map((item) => {
        const Icon = item.icon;
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className={`relative grid min-h-11 place-items-center rounded-full ${
              active ? 'text-[var(--dna-accent)]' : 'text-[var(--dna-text-secondary)]'
            }`}
          >
            <Icon size={24} strokeWidth={1.8} />
            {active && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--dna-accent)]" />}
            {item.href === '/activity' && <ActivityDot />}
          </Link>
        );
      })}
    </nav>
  );
}

function ActivityDot() {
  const viewer = useViewer();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!viewer.signedIn) {
      setCount(0);
      return;
    }

    getRepairAccessRequests()
      .then((requests) => setCount(requests.filter((request) => request.status === 'pending').length))
      .catch(() => setCount(0));
  }, [viewer.signedIn]);

  if (!count) return null;
  return (
    <span className="absolute right-1 top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[var(--dna-danger)] px-1 font-mono text-[11px] font-medium text-white">
      {count}
    </span>
  );
}

export function HomePage() {
  const viewer = useViewer();
  if (viewer.signedIn) return <AuthenticatedHome />;

  return (
    <PublicFrame>
      <header className="flex items-center justify-between gap-4">
        <LogoMark />
        {viewer.configured ? (
          <SignInButton mode="modal" forceRedirectUrl="/">
            <button className="min-h-11 px-2 text-[15px] font-normal text-[var(--dna-accent)]">Sign in</button>
          </SignInButton>
        ) : null}
      </header>

      <section className="pt-16 md:pt-24">
        <h1 className="max-w-xl text-[32px] font-medium leading-tight tracking-[-0.03em] text-[var(--dna-text-primary)] md:text-[56px]">
          The repair history should stay with the device.
        </h1>
        <div className="mt-14 space-y-8">
          <TrustLine icon={<Shield />} text="Owner-controlled access before a technician can add a record." />
          <TrustLine icon={<Lock />} text="Permanent repair entries that are visible, dated, and traceable." />
          <TrustLine icon={<QrCode />} text="A QR passport that opens the same record on any phone." />
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t border-[var(--dna-border)] bg-[var(--dna-background)] p-4">
        <div className="mx-auto grid max-w-2xl gap-3">
          <PrimaryAction href="/register">Register a device</PrimaryAction>
          <SecondaryAction href="/scan">Scan a QR passport</SecondaryAction>
        </div>
      </div>
    </PublicFrame>
  );
}

function AuthenticatedHome() {
  const viewer = useViewer();
  const [devices, setDevices] = useState<Device[]>([]);
  const [frontId, setFrontId] = useState<string | null>(null);
  const [score, setScore] = useState<DeviceScore | null>(null);
  const front = devices.find((device) => device.id === frontId) ?? devices[0] ?? null;

  useEffect(() => {
    if (!viewer.id) return;
    getDevicesForUser(viewer.id).then((items) => {
      setDevices(items);
      setFrontId((current) => current ?? items[0]?.id ?? null);
    }).catch(() => setDevices([]));
  }, [viewer.id]);

  useEffect(() => {
    if (!front) {
      setScore(null);
      return;
    }
    getDeviceScore(front.id).then(setScore).catch(() => setScore(null));
  }, [front]);

  return (
    <AppFrame>
      <header className="flex items-center justify-between gap-4">
        <LogoMark variant="wordmark" />
        <PrimaryAction href="/register"><Plus size={18} /> Register</PrimaryAction>
      </header>

      <section className="mt-12">
        <div className="flex items-end gap-4">
          <h1 className="text-[56px] font-medium leading-none tracking-[-0.05em] md:text-[96px]">
            {front ? score?.health_score ?? 100 : '--'}
          </h1>
          <p className="pb-2 text-[17px] font-normal text-[var(--dna-text-secondary)]">
            {front ? healthSentence(score?.health_score ?? 100) : 'No registered devices yet'}
          </p>
        </div>
        <p className="mt-6 text-[16px] leading-8 text-[var(--dna-text-secondary)]">
          {front
            ? `${front.brand} ${front.model} · ${devices.length} ${devices.length === 1 ? 'device' : 'devices'} in your passport deck · Registered ${formatDate(front.created_at)}.`
            : 'Register a phone or laptop to create a scan-ready repair passport.'}
        </p>
        <div className="mt-8">
          <DeviceDeck devices={devices} activeId={front?.id ?? null} onChoose={setFrontId} />
        </div>
        <p className="mt-8 text-[15px] leading-7 text-[var(--dna-text-secondary)]">
          Latest activity: {front ? `${front.brand} ${front.model} was added to Device DNA on ${formatDate(front.created_at)}.` : 'No activity recorded yet.'}
        </p>
      </section>
    </AppFrame>
  );
}

function DeviceDeck({ devices, activeId, onChoose }: { devices: Device[]; activeId: string | null; onChoose: (id: string) => void }) {
  if (!devices.length) {
    return (
      <Link href="/register" className={`${ui.panel} block p-6`}>
        <Smartphone size={24} strokeWidth={1.8} />
        <h2 className="mt-12 text-[26px] font-medium tracking-[-0.02em]">Create the first passport</h2>
        <p className="mt-3 text-[15px] leading-7 text-[var(--dna-text-secondary)]">The deck appears here after registration.</p>
      </Link>
    );
  }

  const ordered = [
    ...devices.filter((device) => device.id === activeId),
    ...devices.filter((device) => device.id !== activeId),
  ];

  return (
    <div className="relative h-[290px]">
      {ordered.slice(0, 3).reverse().map((device, index) => {
        const depth = 2 - index;
        return (
          <button
            key={device.id}
            type="button"
            onClick={() => onChoose(device.id)}
            className={`${ui.panel} absolute inset-x-0 top-0 h-[240px] p-6 text-left transition-transform`}
            style={{
              transform: `translateY(${depth * 24}px) scale(${1 - depth * 0.035})`,
              zIndex: 10 + index,
            }}
          >
            <div className="flex items-center justify-between">
              {device.device_type === 'phone' ? <Smartphone size={24} strokeWidth={1.8} /> : <Laptop size={24} strokeWidth={1.8} />}
              <span className="font-mono text-[12px] font-normal text-[var(--dna-text-secondary)]">{device.id.slice(0, 8)}</span>
            </div>
            <h3 className="mt-14 text-[28px] font-medium tracking-[-0.025em]">{device.brand} {device.model}</h3>
            <p className="mt-3 text-[15px] text-[var(--dna-text-secondary)]">{device.device_type} passport</p>
          </button>
        );
      })}
    </div>
  );
}

function TrustLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <p className="flex items-start gap-4 text-[17px] leading-7 text-[var(--dna-text-primary)]">
      <span className="mt-1 text-[var(--dna-text-secondary)] [&_svg]:h-5 [&_svg]:w-5 [&_svg]:stroke-[1.8]">{icon}</span>
      {text}
    </p>
  );
}

export function DevicesPage() {
  return (
    <RequireSignIn>
      <DevicesScreen />
    </RequireSignIn>
  );
}

function DevicesScreen() {
  const viewer = useViewer();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DeviceFilter>('all');

  useEffect(() => {
    if (!viewer.id) return;
    let active = true;
    setError('');
    setDevices(null);

    getDevicesForUser(viewer.id)
      .then((items) => {
        if (active) setDevices(items);
      })
      .catch((error) => {
        if (!active) return;
        setError(getServiceErrorMessage(error));
        setDevices([]);
      });

    return () => {
      active = false;
    };
  }, [viewer.id]);

  const filtered = (devices ?? []).filter((device) => {
    const term = `${device.brand} ${device.model} ${device.serial_imei}`.toLowerCase();
    return (filter === 'all' || filter === device.device_type) && term.includes(query.toLowerCase());
  });

  return (
    <AppFrame>
      <ScreenHeader title="Devices" action={<PrimaryAction href="/register"><Plus size={18} /> Register</PrimaryAction>} />
      <div className="mt-8 space-y-4">
        <SearchInput value={query} onChange={setQuery} />
        <PillSwitch value={filter} onChange={setFilter} />
      </div>
      <div className="mt-8 grid gap-4">
        {devices === null ? (
          <LoadingState text="Loading your devices" />
        ) : error ? (
          <EmptyState title="Could not load devices" text={error} />
        ) : filtered.length ? filtered.map((device) => (
          <Link key={device.id} href={`/devices/${device.id}`} className={`${ui.panel} block p-5`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[22px] font-medium tracking-[-0.02em]">{device.brand} {device.model}</h2>
                <p className="mt-2 text-[14px] text-[var(--dna-text-secondary)]">
                  {device.device_type} · {device.serial_imei} · {formatDate(device.created_at)}
                </p>
              </div>
              <ChevronRight size={22} strokeWidth={1.8} />
            </div>
          </Link>
        )) : (
          <EmptyState title="No devices found" text="Register a device or adjust the search." />
        )}
      </div>
    </AppFrame>
  );
}

export function RegisterPage() {
  return (
    <RequireSignIn>
      <RegisterScreen />
    </RequireSignIn>
  );
}

function RegisterScreen() {
  const viewer = useViewer();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<DeviceType | null>(null);
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
    const values: Record<string, string> = {};
    if (type === 'laptop' && form.processor.trim()) values.processor = form.processor.trim();
    if (form.ram.trim()) values.ram = form.ram.trim();
    if (form.storage.trim()) values.storage = form.storage.trim();
    return values;
  }, [form, type]);

  async function submit() {
    if (!viewer.id) return;
    if (!type || !form.brand.trim() || !form.model.trim() || !form.serialImei.trim()) {
      setError('Device type, brand, model, and IMEI or serial are required.');
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
    } catch (err) {
      setError(getServiceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppFrame>
      <ScreenHeader title="Register device" description="Create the permanent identity record first. Repair history comes later." />
      <StepLabels labels={['Type', 'Identify', 'Review', 'QR']} active={step} />
      <section className={`${ui.panel} mt-6 p-5`}>
        {step === 0 && (
          <div className="grid gap-3">
            <ChoiceButton active={type === 'phone'} icon={<Smartphone />} label="Phone" onClick={() => setType('phone')} />
            <ChoiceButton active={type === 'laptop'} icon={<Laptop />} label="Laptop" onClick={() => setType('laptop')} />
          </div>
        )}
        {step === 1 && (
          <div className="grid gap-4">
            <FormField label="Brand"><TextInput value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} placeholder={type === 'phone' ? 'Apple, Samsung, OnePlus' : 'Apple, Lenovo, HP'} /></FormField>
            <FormField label="Model"><TextInput value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder={type === 'phone' ? 'iPhone 15, Galaxy S24' : 'MacBook Air M2, ThinkPad X1'} /></FormField>
            <FormField label={type === 'phone' ? 'IMEI' : 'Serial number'}><TextInput value={form.serialImei} onChange={(event) => setForm({ ...form, serialImei: event.target.value })} placeholder={type === 'phone' ? '15 digit IMEI' : 'Manufacturer serial or service tag'} /></FormField>
            <FormField label="Purchase date"><TextInput type="date" value={form.purchaseDate} onChange={(event) => setForm({ ...form, purchaseDate: event.target.value })} /></FormField>
            {type === 'laptop' && <FormField label="Processor"><TextInput value={form.processor} onChange={(event) => setForm({ ...form, processor: event.target.value })} placeholder="Apple M2, Intel i7, Ryzen 5" /></FormField>}
            <FormField label="RAM"><TextInput value={form.ram} onChange={(event) => setForm({ ...form, ram: event.target.value })} placeholder="Optional, for example 8 GB" /></FormField>
            <FormField label="Storage"><TextInput value={form.storage} onChange={(event) => setForm({ ...form, storage: event.target.value })} placeholder="Optional, for example 256 GB" /></FormField>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-5">
            <p className="text-[17px] leading-8">Device identity details cannot be silently changed after registration. Corrections must be recorded transparently.</p>
            <ReviewLine label="Type" value={type ?? '-'} />
            <ReviewLine label="Device" value={`${form.brand || '-'} ${form.model || ''}`} />
            <ReviewLine label={type === 'phone' ? 'IMEI' : 'Serial'} value={form.serialImei || '-'} />
            {error && <Notice tone="danger">{error}</Notice>}
          </div>
        )}
        {step === 3 && created && (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] font-medium tracking-[-0.025em]">QR passport ready</h2>
              <p className="mt-2 text-[15px] text-[var(--dna-text-secondary)]">Print it, save it, or open the owner timeline.</p>
            </div>
            <QrBlock value={passportUrl(created.id)} fileName={`${created.brand}-${created.model}-device-dna`.replace(/\s+/g, '-').toLowerCase()} />
            <div className="grid gap-3">
              <PrimaryAction href={`/devices/${created.id}`}>Open timeline</PrimaryAction>
              <SecondaryAction href="/devices">Back to devices</SecondaryAction>
            </div>
          </div>
        )}
      </section>
      {step < 3 && (
        <div className="mt-5 flex gap-3">
          <SecondaryAction disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>Back</SecondaryAction>
          {step === 2 ? (
            <PrimaryAction disabled={busy} onClick={submit}>{busy ? 'Registering' : 'Create passport'}</PrimaryAction>
          ) : (
            <PrimaryAction disabled={step === 0 && !type} onClick={() => setStep(step + 1)}>Continue</PrimaryAction>
          )}
        </div>
      )}
    </AppFrame>
  );
}

export function DevicePage() {
  return (
    <RequireSignIn>
      <DeviceScreen publicMode={false} />
    </RequireSignIn>
  );
}

function DeviceScreen({ publicMode }: { publicMode: boolean }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const viewer = useViewer();
  const [timeline, setTimeline] = useState<DeviceTimeline | null | undefined>(undefined);
  const [score, setScore] = useState<DeviceScore | null>(null);
  const [access, setAccess] = useState<AccessState>(undefined);
  const isOwner = timeline ? viewer.id === timeline.owner_id : false;

  useEffect(() => {
    const load = publicMode ? getPublicPassportTimeline(params.id) : getDeviceTimeline(params.id);
    load.then((next) => {
      setTimeline(next);
      setScore(next?.device_scores?.[0] ?? null);
      if (next && !publicMode) getDeviceScore(next.id).then(setScore).catch(() => undefined);
    }).catch(() => setTimeline(null));
  }, [params.id, publicMode]);

  useEffect(() => {
    if (!timeline || !viewer.id || viewer.id === timeline.owner_id) {
      setAccess(null);
      return;
    }
    setAccess(undefined);
    getRepairAccessStatus(timeline.id, viewer.id).then(setAccess).catch(() => setAccess(null));
  }, [timeline, viewer.id]);

  const frame = publicMode ? PublicFrame : AppFrame;
  const Frame = frame;
  const passportTimeline = timeline
    ? {
        ...timeline,
        repair_events: timeline.repair_events.filter((event) => event.status === 'approved'),
      }
    : null;
  const backControl = publicMode ? (
    <BackControl
      label="Back"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back();
          return;
        }
        router.push('/');
      }}
    />
  ) : null;

  if (timeline === undefined) return <Frame>{backControl}<LoadingState text="Loading passport" /></Frame>;
  if (!timeline) return <Frame>{backControl}<EmptyState title="Passport not found" text="Check the Device DNA link or open it from your account." /></Frame>;

  return (
    <Frame>
      {backControl}
      <DeviceHeader timeline={passportTimeline ?? timeline} score={score} showSerial={!publicMode && isOwner} publicMode={publicMode} />
      <section className="mt-10">
        <div className="grid gap-4 border-b border-[var(--dna-border)] pb-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--dna-text-muted)]">Repairs</p>
            <h2 className="mt-2 text-[28px] font-medium tracking-[-0.03em]">{publicMode ? 'Public timeline' : 'Device timeline'}</h2>
            <p className="mt-2 text-[15px] leading-7 text-[var(--dna-text-secondary)]">
              {publicMode ? 'Approved repair records only, with private owner identifiers hidden.' : 'Approved repair records for this device.'}
            </p>
          </div>
          {!isOwner && access === 'approved' ? (
            <div className="min-w-0 sm:min-w-[160px]">
              <PrimaryAction href={`/devices/${timeline.id}/repair`}><Plus size={18} /> Add log</PrimaryAction>
            </div>
          ) : null}
        </div>
        <RepairList repairs={(passportTimeline ?? timeline).repair_events} />
        {publicMode || !isOwner ? (
          <AccessPanel device={timeline} status={access} onSubmitted={() => setAccess('pending')} />
        ) : (
          <div className="mt-8">
            <QrBlock value={passportUrl(timeline.id)} fileName={`${timeline.brand}-${timeline.model}-device-dna`.replace(/\s+/g, '-').toLowerCase()} />
          </div>
        )}
      </section>
    </Frame>
  );
}

function BackControl({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-8 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--dna-border)] bg-[var(--dna-background)] px-4 text-[15px] text-[var(--dna-text-primary)]"
    >
      <ChevronRight size={19} strokeWidth={1.8} className="rotate-180" />
      {label}
    </button>
  );
}

export function PassportPage() {
  return (
    <RequireSignIn>
      <DeviceScreen publicMode />
    </RequireSignIn>
  );
}

export function RepairSubmissionPage() {
  return (
    <RequireSignIn>
      <RepairSubmissionScreen />
    </RequireSignIn>
  );
}

function RepairSubmissionScreen() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const viewer = useViewer();
  const [timeline, setTimeline] = useState<DeviceTimeline | null | undefined>(undefined);
  const [access, setAccess] = useState<AccessState>(undefined);
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

  useEffect(() => {
    if (!timeline || !viewer.id || viewer.id === timeline.owner_id) {
      setAccess(null);
      return;
    }
    getRepairAccessStatus(timeline.id, viewer.id).then(setAccess).catch(() => setAccess(null));
  }, [timeline, viewer.id]);

  async function submit() {
    if (!viewer.id || !timeline) return;
    if (!form.symptom.trim() || !form.actionTaken.trim()) {
      setError('Symptoms and action taken are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await submitRepairRecord({
        deviceId: timeline.id,
        technicianId: viewer.id,
        symptom: form.symptom.trim(),
        diagnosis: form.diagnosis.trim() || null,
        actionTaken: form.actionTaken.trim(),
        cost: numberOrNull(form.serviceCost),
        parts: form.partNumber || form.supplier || Number(form.partCost) > 0 ? [{
          componentName: form.componentName,
          partType: form.partType,
          partNumber: form.partNumber || null,
          supplier: form.supplier || null,
          cost: numberOrNull(form.partCost),
          warrantyDays: Number(form.warrantyDays) || 0,
        }] : [],
      });
      router.push(`/devices/${timeline.id}`);
    } catch (err) {
      setError(getServiceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (timeline === undefined) return <AppFrame><LoadingState text="Loading device" /></AppFrame>;
  if (!timeline) return <AppFrame><EmptyState title="Device not found" text="Scan again or check the ID." /></AppFrame>;

  const blocked = viewer.id === timeline.owner_id || access !== 'approved';

  return (
    <AppFrame>
      <ScreenHeader title="Add repair log" description={`${timeline.brand} ${timeline.model}. The record becomes permanent after submission.`} />
      {blocked ? (
        <section className={`${ui.panel} mt-8 p-5`}>
          <p className="text-[17px] leading-8">
            {viewer.id === timeline.owner_id ? 'Owner accounts cannot add repair logs to their own device.' : 'Owner approval is required before adding a repair log.'}
          </p>
          {viewer.id !== timeline.owner_id && <AccessPanel device={timeline} status={access} onSubmitted={() => setAccess('pending')} />}
        </section>
      ) : (
        <section className={`${ui.panel} mt-8 grid gap-4 p-5`}>
          <FormField label="Symptoms"><TextArea value={form.symptom} onChange={(event) => setForm({ ...form, symptom: event.target.value })} placeholder="Charging only works at an angle; battery drains quickly." /></FormField>
          <FormField label="Diagnosis"><TextArea value={form.diagnosis} onChange={(event) => setForm({ ...form, diagnosis: event.target.value })} placeholder="Charging connector worn; no board damage seen." /></FormField>
          <FormField label="Action taken"><TextArea value={form.actionTaken} onChange={(event) => setForm({ ...form, actionTaken: event.target.value })} placeholder="Replaced charging assembly and tested fast charging." /></FormField>
          <FormField label="Component"><SelectInput value={form.componentName} onChange={(event) => setForm({ ...form, componentName: event.target.value as ComponentName })}>{componentOptions[timeline.device_type].map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</SelectInput></FormField>
          <FormField label="Part type"><SelectInput value={form.partType} onChange={(event) => setForm({ ...form, partType: event.target.value as PartType })}>{partTypes.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</SelectInput></FormField>
          <FormField label="Part number"><TextInput value={form.partNumber} onChange={(event) => setForm({ ...form, partNumber: event.target.value })} placeholder="Supplier SKU or part number" /></FormField>
          <FormField label="Supplier"><TextInput value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} placeholder="Shop stock or supplier name" /></FormField>
          <FormField label="Part cost"><TextInput type="number" min="0" value={form.partCost} onChange={(event) => setForm({ ...form, partCost: event.target.value })} placeholder="1450" /></FormField>
          <FormField label="Part warranty days"><TextInput type="number" min="0" value={form.warrantyDays} onChange={(event) => setForm({ ...form, warrantyDays: event.target.value })} placeholder="90" /></FormField>
          <FormField label="Service cost"><TextInput type="number" min="0" value={form.serviceCost} onChange={(event) => setForm({ ...form, serviceCost: event.target.value })} placeholder="2300" /></FormField>
          {error && <Notice tone="danger">{error}</Notice>}
          <PrimaryAction disabled={busy} onClick={submit}>{busy ? 'Submitting' : 'Create permanent repair record'}</PrimaryAction>
        </section>
      )}
    </AppFrame>
  );
}

export function ScanPage() {
  return <ScanScreen />;
}

function ScanScreen() {
  const router = useRouter();
  const scannerRef = useRef<Html5Scanner | null>(null);
  const running = useRef(false);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');

  async function openValue(value: string) {
    const parsed = parseDeviceCode(value);
    if (!parsed) {
      setMessage('Enter a valid passport link, device ID, serial, or IMEI.');
      return;
    }
    if (shouldOpenPassportDirectly(value, parsed)) {
      router.push(`/passport/${parsed}`);
      return;
    }
    const device = await lookupDevice(parsed).catch(() => null);
    if (!device) {
      setMessage('No device found.');
      return;
    }
    router.push(`/passport/${device.id}`);
  }

  async function stopScanner() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (running.current) await scanner.stop();
    } catch {
      // already stopped
    }
    running.current = false;
    scanner.clear();
  }

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        const scanner = new Html5Qrcode('device-dna-camera') as Html5Scanner;
        scannerRef.current = scanner;
        const config = { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 };
        const success = async (text: string) => {
          await stopScanner();
          await openValue(text);
        };
        try {
          await scanner.start({ facingMode: { exact: 'environment' } }, config, success, () => undefined);
        } catch {
          try {
            await scanner.start({ facingMode: 'environment' }, config, success, () => undefined);
          } catch {
            const cameras = await Html5Qrcode.getCameras();
            if (!cameras[0]?.id) throw new Error('No camera found');
            await scanner.start(cameras[0].id, config, success, () => undefined);
          }
        }
        running.current = true;
      } catch (err) {
        setMessage(`Camera unavailable. Manual lookup still works. ${getServiceErrorMessage(err)}`);
      }
    }
    void start();
    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, []);

  async function scanFile(file: File | undefined) {
    if (!file) return;
    try {
      await stopScanner();
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('device-dna-upload') as Html5Scanner;
      const text = await scanner.scanFile(file, true);
      scanner.clear();
      await openValue(text);
    } catch (err) {
      setMessage(`Could not read that QR image. ${getServiceErrorMessage(err)}`);
    }
  }

  return (
    <PublicFrame>
      <header className="flex items-center justify-between">
        <LogoMark />
        <Link href="/" className={ui.link}>Home</Link>
      </header>
      <section className="mt-10">
        <ScreenHeader title="Scan passport" description="Use a camera, upload a QR image, or paste a passport link." />
        <div className={`${ui.panel} mt-6 overflow-hidden p-4`}>
          <div id="device-dna-camera" className="min-h-[280px]" />
          <div id="device-dna-upload" className="hidden" />
        </div>
        <div className="mt-6 grid gap-3">
          <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Paste passport link, ID, serial, or IMEI" />
          {message && <Notice tone="warning">{message}</Notice>}
          <PrimaryAction onClick={() => void openValue(query)}>Find device</PrimaryAction>
          <label className={ui.secondaryButton}>
            <Upload size={18} /> Upload QR image
            <input type="file" accept="image/*" className="sr-only" onChange={(event) => void scanFile(event.target.files?.[0])} />
          </label>
        </div>
      </section>
    </PublicFrame>
  );
}

export function ActivityPage() {
  return (
    <RequireSignIn>
      <ActivityScreen />
    </RequireSignIn>
  );
}

function ActivityScreen() {
  const [requests, setRequests] = useState<RepairAccessRequestWithDevice[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    getRepairAccessRequests().then(setRequests).catch(() => setRequests([]));
  }, []);

  async function decide(id: string, decision: 'approved' | 'declined') {
    const previous = requests;
    setRequests((items) => items.map((item) => item.id === id ? { ...item, status: decision, decided_at: new Date().toISOString() } : item));
    setNotice(decision === 'approved' ? 'Request approved.' : 'Request declined.');
    try {
      await decideRepairAccessRequest(id, decision);
    } catch (err) {
      setRequests(previous);
      setNotice(getServiceErrorMessage(err));
    }
  }

  const visible = requests.filter((request) => (
    filter === 'all' ||
    request.status === filter ||
    (filter === 'approved' && request.status === 'declined')
  ));

  return (
    <AppFrame>
      <ScreenHeader title="Activity" description="Technician access requests and past decisions." />
      <div className="mt-8 grid grid-cols-3 rounded-full border border-[var(--dna-border)] bg-[var(--dna-background)] p-1">
        {(['all', 'pending', 'approved'] as const).map((item) => (
          <button key={item} className={tabClass(filter === item)} onClick={() => setFilter(item)}>
            <span className="inline-flex items-center justify-center gap-1.5">
              {filter === item && <Check size={14} strokeWidth={1.8} />}
              {item === 'approved' ? 'Decided' : item[0].toUpperCase() + item.slice(1)}
            </span>
          </button>
        ))}
      </div>
      {notice && <Notice tone="success">{notice}</Notice>}
      <div className="mt-6 divide-y divide-[var(--dna-border)]">
        {visible.length ? visible.map((request) => (
          <div key={request.id} className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[17px] font-medium">{request.requester_name}</p>
                <p className="mt-1 text-[14px] leading-6 text-[var(--dna-text-secondary)]">{request.shop_name} · {request.requester_phone}</p>
                <p className="mt-1 text-[14px] text-[var(--dna-text-secondary)]">{getRequestDeviceName(request)} · {formatDateTime(request.created_at)}</p>
              </div>
              <StatusPill value={request.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <SecondaryAction href={`/devices/${request.device_id}`}>Open</SecondaryAction>
              {request.status === 'pending' ? (
                <>
                  <PrimaryAction onClick={() => void decide(request.id, 'approved')}>Approve</PrimaryAction>
                  <SecondaryAction onClick={() => void decide(request.id, 'declined')}>Decline</SecondaryAction>
                </>
              ) : null}
            </div>
          </div>
        )) : <EmptyState title="No activity matches this filter" />}
      </div>
    </AppFrame>
  );
}

export function AccountPage() {
  return (
    <RequireSignIn>
      <AccountScreen />
    </RequireSignIn>
  );
}

function AccountScreen() {
  const viewer = useViewer();
  const [phone, setPhone] = useState(viewer.phone === 'Phone number not added' ? '' : viewer.phone);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPhone(viewer.phone === 'Phone number not added' ? '' : viewer.phone);
  }, [viewer.phone]);

  async function save() {
    if (!viewer.id) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await updateProfilePhone(viewer.id, phone);
      setSaved(true);
    } catch (error) {
      setError(getServiceErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppFrame>
      <ScreenHeader title="Profile" description="Account details used for repair access and owner activity." />
      <section className={`${ui.panel} mt-8 p-5`}>
        <div className="flex items-center gap-4">
          {viewer.imageUrl ? (
            <img src={viewer.imageUrl} alt={viewer.name} className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-full border border-[var(--dna-border)] text-[20px] font-medium">
              {viewer.name.slice(0, 1)}
            </div>
          )}
          <div>
            <h1 className="text-[22px] font-medium">{viewer.name}</h1>
            <p className="mt-1 text-[14px] text-[var(--dna-text-secondary)]">{viewer.email}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4">
          <FormField label="Phone number"><TextInput value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" /></FormField>
          {saved && <Notice tone="success">Phone number saved to your account.</Notice>}
          {error && <Notice tone="danger">{error}</Notice>}
          <PrimaryAction onClick={() => void save()} disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</PrimaryAction>
          <SignOutButton>
            <button className={ui.secondaryButton}><X size={18} /> Sign out</button>
          </SignOutButton>
        </div>
      </section>
    </AppFrame>
  );
}

function RequireSignIn({ children }: { children: React.ReactNode }) {
  const viewer = useViewer();
  const pathname = usePathname();
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    if (viewer.ready) {
      setWaiting(false);
      return;
    }
    const timer = window.setTimeout(() => setWaiting(false), 1500);
    return () => window.clearTimeout(timer);
  }, [viewer.ready]);

  if (!viewer.configured) return <PublicFrame><EmptyState title="Auth is not configured" text="Add the Clerk publishable key and restart the app." /></PublicFrame>;
  if (waiting) return <PublicFrame><LoadingState text="Checking sign in" /></PublicFrame>;
  if (!viewer.signedIn) {
    return (
      <PublicFrame>
        <header className="flex items-center justify-between"><LogoMark /><Link href="/" className={ui.link}>Home</Link></header>
        <section className="mt-20">
          <Lock size={24} strokeWidth={1.8} />
          <h1 className="mt-6 text-[32px] font-medium tracking-[-0.03em]">Sign in to continue</h1>
          <p className="mt-4 text-[16px] leading-8 text-[var(--dna-text-secondary)]">This keeps owner records and technician requests attached to the right account.</p>
          <div className="mt-8 grid gap-3">
            <SignInButton mode="modal" forceRedirectUrl={pathname}>
              <button className={ui.primaryButton}>Sign in</button>
            </SignInButton>
            <SignUpButton mode="modal" forceRedirectUrl={pathname}>
              <button className={ui.secondaryButton}>Create account</button>
            </SignUpButton>
          </div>
        </section>
      </PublicFrame>
    );
  }
  return <>{children}</>;
}

function ScreenHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  const router = useRouter();

  return (
    <header className="flex items-start justify-between gap-4 border-b border-[var(--dna-border)] pb-6">
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="mb-4 grid min-h-11 min-w-11 place-items-center rounded-full border border-[var(--dna-border)] bg-[var(--dna-background)]"
        >
          <ChevronRight size={22} strokeWidth={1.8} className="rotate-180" />
        </button>
        <h1 className="text-[28px] font-medium leading-tight tracking-[-0.03em] md:text-[40px]">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-[15px] leading-7 text-[var(--dna-text-secondary)]">{description}</p>}
      </div>
      {action}
    </header>
  );
}

function DeviceHeader({ timeline, score, showSerial, publicMode }: { timeline: DeviceTimeline; score: DeviceScore | null; showSerial: boolean; publicMode: boolean }) {
  const value = score?.health_score ?? (timeline.repair_events.length ? 86 : 100);
  return (
    <section className="divide-y divide-[var(--dna-border)]">
      <div className="pb-8">
        <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--dna-text-muted)]">Identity</p>
        <p className="mt-3 text-[14px] text-[var(--dna-text-secondary)]">{publicMode ? 'Read-only public passport' : 'Owner device timeline'}</p>
        <h1 className="mt-3 break-words text-[36px] font-medium leading-tight tracking-[-0.035em] md:text-[56px]">{timeline.brand} {timeline.model}</h1>
        {showSerial && <p className="mt-3 break-all font-mono text-[13px] text-[var(--dna-text-secondary)]">{timeline.device_type === 'phone' ? 'IMEI' : 'Serial'} {timeline.serial_imei}</p>}
      </div>
      <div className="py-8">
        <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--dna-text-muted)]">Health</p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <span className="text-[56px] font-medium leading-none tracking-[-0.05em]">{value}</span>
          <span className="pb-2 text-[16px] text-[var(--dna-text-secondary)]">{healthSentence(value)}</span>
        </div>
        <p className="mt-4 text-[16px] leading-8 text-[var(--dna-text-secondary)]">
          {score?.ai_summary ?? (timeline.repair_events.length ? 'This score reflects the repair records currently visible in the passport.' : 'No repair records are attached to this device yet.')}
        </p>
      </div>
    </section>
  );
}

function RepairList({ repairs }: { repairs: RepairEventWithParts[] }) {
  if (!repairs.length) return <EmptyState title="No repairs logged yet" text="Clean history." />;
  return (
    <div className="mt-8">
      {repairs.map((repair, index) => (
        <article key={repair.id} className="grid grid-cols-[28px_1fr] gap-4">
          <div className="relative flex justify-center">
            <span className="mt-1 h-3 w-3 rounded-full border border-[var(--dna-text-primary)] bg-[var(--dna-background)]" />
            {index < repairs.length - 1 && <span className="absolute bottom-0 top-6 w-px bg-[var(--dna-border)]" />}
          </div>
          <div className="pb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="break-words text-[20px] font-medium tracking-[-0.02em]">{repair.symptom}</h3>
              <p className="mt-2 text-[14px] text-[var(--dna-text-secondary)]">{formatDateTime(repair.created_at)} · {repair.profiles?.display_name ?? 'Technician'}</p>
            </div>
            <span className="shrink-0 text-[14px] text-[var(--dna-text-secondary)]">{formatCurrency(repair.cost)}</span>
          </div>
          <p className="mt-4 break-words text-[15px] leading-7 text-[var(--dna-text-secondary)]">{repair.diagnosis || 'No diagnosis recorded.'}</p>
          <p className="mt-2 break-words text-[15px] leading-7">{repair.action_taken}</p>
          {repair.parts.length ? (
            <p className="mt-3 break-words text-[14px] text-[var(--dna-text-secondary)]">
              Parts: {repair.parts.map((part) => `${pretty(part.component_name)} · ${part.warranty_days} warranty days`).join(', ')}
            </p>
          ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function AccessPanel({ device, status, onSubmitted }: { device: DeviceTimeline; status: AccessState; onSubmitted: () => void }) {
  const viewer = useViewer();
  const [form, setForm] = useState({ requesterName: viewer.name === 'Visitor' ? '' : viewer.name, requesterPhone: '', shopName: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (device.owner_id === viewer.id) return null;
  if (status === undefined) return <LoadingState text="Checking access" />;
  if (status === 'approved') {
    return (
      <section className="mt-8 grid gap-3">
        <Notice tone="success">Technician access is approved for this account.</Notice>
        <PrimaryAction href={`/devices/${device.id}/repair`}><Plus size={18} /> Add repair log</PrimaryAction>
      </section>
    );
  }
  if (status === 'pending') return <Notice tone="warning">Access request sent. The owner can approve it in Activity.</Notice>;

  async function submit() {
    if (!viewer.signedIn) {
      setMessage('Sign in before requesting access.');
      return;
    }
    if (!form.requesterName.trim() || !form.requesterPhone.trim() || !form.shopName.trim()) {
      setMessage('Name, phone number, and shop name are required.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await requestRepairAccess({ deviceId: device.id, requesterName: form.requesterName, requesterPhone: form.requesterPhone, shopName: form.shopName });
      onSubmitted();
    } catch (err) {
      setMessage(getServiceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${ui.panel} mt-8 grid gap-4 p-5`}>
      <h2 className="text-[22px] font-medium tracking-[-0.02em]">Request technician access</h2>
      <FormField label="Your name"><TextInput value={form.requesterName} onChange={(event) => setForm({ ...form, requesterName: event.target.value })} placeholder="Technician full name" /></FormField>
      <FormField label="Phone number"><TextInput value={form.requesterPhone} onChange={(event) => setForm({ ...form, requesterPhone: event.target.value })} placeholder="+91 98765 43210" /></FormField>
      <FormField label="Shop name"><TextInput value={form.shopName} onChange={(event) => setForm({ ...form, shopName: event.target.value })} placeholder="Service centre name" /></FormField>
      {message && <Notice tone="warning">{message}</Notice>}
      <PrimaryAction disabled={busy} onClick={submit}>{busy ? 'Sending' : 'Request access'}</PrimaryAction>
    </section>
  );
}

function QrBlock({ value, fileName }: { value: string; fileName: string }) {
  const id = useMemo(() => `qr-${Math.random().toString(36).slice(2)}`, []);
  function download() {
    const svg = document.getElementById(id);
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const padding = 32;
      canvas.width = image.width + padding * 2;
      canvas.height = image.height + padding * 2;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.fillStyle = dnaCssVariables['--dna-background'] as string;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, padding, padding);
      const anchor = document.createElement('a');
      anchor.href = canvas.toDataURL('image/png');
      anchor.download = `${fileName}.png`;
      anchor.click();
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;
  }
  return (
    <section className={`${ui.panel} p-5`}>
      <div className="grid place-items-center">
        <QRCodeSVG id={id} value={value} size={200} bgColor={dnaCssVariables['--dna-background'] as string} fgColor={dnaCssVariables['--dna-text-primary'] as string} />
      </div>
      <p className="mt-4 break-all font-mono text-[12px] text-[var(--dna-text-secondary)]">{value}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <SecondaryAction onClick={download}><Download size={18} /> Download</SecondaryAction>
        <SecondaryAction onClick={() => window.print()}><FileText size={18} /> Print</SecondaryAction>
      </div>
    </section>
  );
}

function PrimaryAction({ href, children, disabled, onClick }: { href?: string; children: React.ReactNode; disabled?: boolean; onClick?: () => void }) {
  if (href) return <Link href={href} className={ui.primaryButton}>{children}</Link>;
  return <button type="button" disabled={disabled} onClick={onClick} className={ui.primaryButton}>{children}</button>;
}

function SecondaryAction({ href, children, disabled, onClick }: { href?: string; children: React.ReactNode; disabled?: boolean; onClick?: () => void }) {
  if (href) return <Link href={href} className={ui.secondaryButton}>{children}</Link>;
  return <button type="button" disabled={disabled} onClick={onClick} className={ui.secondaryButton}>{children}</button>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${ui.field} ${props.className ?? ''}`} />;
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${ui.field} ${props.className ?? ''}`} />;
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${ui.field} min-h-28 py-3 ${props.className ?? ''}`} />;
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[14px] text-[var(--dna-text-secondary)]">{label}</span><span className="mt-2 block">{children}</span></label>;
}

function SearchInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex min-h-[var(--dna-touch-target)] items-center gap-3 rounded-[var(--dna-pill-radius)] border border-[var(--dna-border)] bg-[var(--dna-background)] px-4">
      <Search size={18} strokeWidth={1.8} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search devices" className="w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--dna-text-secondary)]" />
    </label>
  );
}

function PillSwitch({ value, onChange }: { value: DeviceFilter; onChange: (value: DeviceFilter) => void }) {
  return (
    <div className="grid grid-cols-3 rounded-[var(--dna-pill-radius)] border border-[var(--dna-border)] bg-[var(--dna-background)] p-1">
      {(['all', 'phone', 'laptop'] as DeviceFilter[]).map((item) => (
        <button key={item} onClick={() => onChange(item)} className={tabClass(value === item)}>
          <span className="inline-flex items-center justify-center gap-1.5">
            {value === item && <Check size={14} strokeWidth={1.8} />}
            {item === 'all' ? 'All' : item === 'phone' ? 'Phones' : 'Laptops'}
          </span>
        </button>
      ))}
    </div>
  );
}

function StepLabels({ labels, active }: { labels: string[]; active: number }) {
  return (
    <div className="mt-8 grid gap-2" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
      {labels.map((label, index) => <span key={label} className={`h-1 rounded-full ${index <= active ? 'bg-[var(--dna-accent)]' : 'bg-[var(--dna-border)]'}`} />)}
    </div>
  );
}

function ChoiceButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${ui.panel} relative min-h-32 p-5 text-left ${
        active ? 'border-[1.5px] border-[var(--dna-text-primary)] bg-[var(--dna-surface)]' : ''
      }`}
    >
      {active && (
        <span className="absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full bg-[var(--dna-text-primary)] text-[var(--dna-background)]">
          <Check size={14} strokeWidth={1.8} />
        </span>
      )}
      <span className="[&_svg]:h-6 [&_svg]:w-6 [&_svg]:stroke-[1.8]">{icon}</span>
      <span className="mt-8 block text-[24px] font-medium">{label}</span>
    </button>
  );
}

function ReviewLine({ label, value }: { label: string; value: React.ReactNode }) {
  return <p className="flex flex-wrap justify-between gap-4 border-b border-[var(--dna-border)] py-3 text-[15px]"><span className="text-[var(--dna-text-secondary)]">{label}</span><span className="break-words text-right">{value}</span></p>;
}

function Notice({ children, tone }: { children: React.ReactNode; tone: 'success' | 'warning' | 'danger' }) {
  const color = tone === 'success' ? 'var(--dna-success-text)' : tone === 'warning' ? 'var(--dna-warning)' : 'var(--dna-danger)';
  return <p className="rounded-[var(--dna-control-radius)] border border-[var(--dna-border)] bg-[var(--dna-background)] px-4 py-3 text-[14px]" style={{ color }}>{children}</p>;
}

function StatusPill({ value }: { value: string }) {
  const color = value === 'approved' ? 'var(--dna-success-text)' : value === 'declined' ? 'var(--dna-text-secondary)' : 'var(--dna-warning)';
  return <span className="rounded-full border border-[var(--dna-border)] px-3 py-1 text-[13px]" style={{ color }}>{value}</span>;
}

function LoadingState({ text }: { text: string }) {
  return <p className="pt-20 text-[17px] text-[var(--dna-text-secondary)]">{text}...</p>;
}

function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <section className="py-14">
      <ListChecks size={24} strokeWidth={1.8} />
      <h2 className="mt-5 text-[24px] font-medium tracking-[-0.02em]">{title}</h2>
      {text && <p className="mt-2 text-[15px] leading-7 text-[var(--dna-text-secondary)]">{text}</p>}
    </section>
  );
}

function tabClass(active: boolean) {
  return `min-h-11 rounded-full px-4 text-[15px] font-normal ${
    active
      ? 'border-[1.5px] border-[var(--dna-text-primary)] bg-[var(--dna-surface)] text-[var(--dna-text-primary)]'
      : 'text-[var(--dna-text-secondary)]'
  }`;
}

function healthSentence(score: number) {
  if (score >= 85) return 'Strong device health';
  if (score >= 65) return 'Some attention needed';
  return 'Review before resale or repair';
}

function getRequestDeviceName(request: RepairAccessRequestWithDevice) {
  const device = Array.isArray(request.devices) ? request.devices[0] : request.devices;
  return device ? `${device.brand} ${device.model}` : 'Device';
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

function shouldOpenPassportDirectly(rawValue: string, parsed: string) {
  if (isUuid(parsed)) return true;
  try {
    const url = new URL(rawValue.trim());
    return url.pathname.split('/').some((part) => ['passport', 'devices', 'timeline'].includes(part));
  } catch {
    return false;
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
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

type Html5Scanner = {
  start: (
    cameraConfig: string | MediaTrackConstraints,
    configuration: { fps: number; qrbox: { width: number; height: number }; aspectRatio: number },
    success: (decodedText: string) => void,
    error?: () => void,
  ) => Promise<unknown>;
  stop: () => Promise<unknown>;
  clear: () => void;
  scanFile: (file: File, showImage?: boolean) => Promise<string>;
};
