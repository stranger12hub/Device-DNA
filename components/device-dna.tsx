'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  Camera,
  Check,
  ChevronRight,
  CircleUserRound,
  ClipboardList,
  Clock,
  Copy,
  FileText,
  Home,
  Laptop,
  Lock,
  Plus,
  QrCode,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import type { Activity, Device, HealthFactor, Job, Part, RepairEvent, WarrantyCardData } from '@/lib/mock-data';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/services';

const ownerNav = [
  { label: 'Home', href: '/owner/home', icon: Home },
  { label: 'Devices', href: '/owner/devices', icon: Smartphone },
  { label: 'Scan', href: '/scan', icon: ScanLine },
  { label: 'Activity', href: '/owner/activity', icon: ActivityIcon },
  { label: 'Account', href: '/owner/account', icon: CircleUserRound },
];

const techNav = [
  { label: 'Home', href: '/technician/home', icon: Home },
  { label: 'Jobs', href: '/technician/jobs', icon: BriefcaseBusiness },
  { label: 'Scan', href: '/scan', icon: ScanLine },
  { label: 'Activity', href: '/technician/activity', icon: ActivityIcon },
  { label: 'Account', href: '/technician/account', icon: CircleUserRound },
];

export function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <img src="/device-dna-logo.jpeg" alt="Device DNA" className={`${compact ? 'h-10 w-10' : 'h-12 w-12'} rounded-[14px] object-cover`} />
      {!compact && (
        <span>
          <span className="block text-sm font-semibold uppercase tracking-[0.18em] text-device-ink">Device DNA</span>
          <span className="block text-xs text-device-slate">Permanent device history</span>
        </span>
      )}
    </Link>
  );
}

export function AppShell({ role, children }: { role: 'owner' | 'technician'; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-device-ice text-device-ink">
      <NavRail role={role} />
      <main className="mx-auto min-h-screen w-full max-w-[1440px] px-4 pb-28 pt-5 md:pl-28 md:pr-6 md:pt-6">{children}</main>
      <BottomNav role={role} />
    </div>
  );
}

export function NavRail({ role }: { role: 'owner' | 'technician' }) {
  const pathname = usePathname();
  const nav = role === 'owner' ? ownerNav : techNav;
  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-24 border-r border-device-border bg-white md:block">
      <div className="flex h-full flex-col items-center gap-5 py-5">
        <LogoMark compact />
        <nav className="flex flex-1 flex-col items-center gap-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href) || (item.href === '/scan' && pathname === '/scan');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-14 w-16 flex-col items-center justify-center gap-1 border text-[11px] transition ${
                  active ? 'border-device-blue bg-device-blue text-white' : 'border-transparent text-device-slate hover:border-device-border hover:bg-device-ice'
                } ${item.href === '/scan' ? 'mt-4 border-device-midnight bg-device-midnight text-white' : ''}`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export function BottomNav({ role }: { role: 'owner' | 'technician' }) {
  const pathname = usePathname();
  const nav = role === 'owner' ? ownerNav : techNav;
  return (
    <nav className="fixed bottom-4 left-1/2 z-50 grid h-[72px] w-[calc(100%-24px)] max-w-md -translate-x-1/2 grid-cols-5 items-center border border-device-border bg-white px-2 md:hidden">
      {nav.map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.href);
        const isScan = item.href === '/scan';
        return (
          <Link key={item.href} href={item.href} className="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] text-device-slate">
            <span
              className={`flex items-center justify-center ${
                isScan
                  ? '-mt-8 h-16 w-16 border-4 border-device-midnight bg-device-blue text-white'
                  : `h-8 w-8 border ${active ? 'border-device-blue text-device-blue' : 'border-transparent'}`
              }`}
            >
              <Icon size={isScan ? 24 : 18} />
            </span>
            <span className={isScan ? 'font-semibold text-device-ink' : ''}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-device-blue">{eyebrow}</p>}
        <h1 className="max-w-4xl text-3xl font-semibold tracking-normal text-device-ink md:text-5xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-sm leading-6 text-device-slate md:text-base">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function PrimaryButton({ href, children, type = 'button', disabled = false, onClick }: { href?: string; children: React.ReactNode; type?: 'button' | 'submit'; disabled?: boolean; onClick?: () => void }) {
  const className = "inline-flex min-h-11 items-center justify-center gap-2 border border-device-blue bg-device-blue px-4 text-sm font-semibold text-white transition hover:bg-device-cobalt disabled:cursor-not-allowed disabled:opacity-50";
  if (href) return <Link href={href} className={className}>{children}</Link>;
  return <button type={type} disabled={disabled} onClick={onClick} className={className}>{children}</button>;
}

export function SecondaryButton({ href, children, type = 'button', onClick }: { href?: string; children: React.ReactNode; type?: 'button' | 'submit'; onClick?: () => void }) {
  const className = "inline-flex min-h-11 items-center justify-center gap-2 border border-device-border bg-white px-4 text-sm font-semibold text-device-ink transition hover:border-device-blue hover:text-device-blue";
  if (href) return <Link href={href} className={className}>{children}</Link>;
  return <button type={type} onClick={onClick} className={className}>{children}</button>;
}

export function StatusBadge({ label, tone }: { label: string; tone: 'healthy' | 'attention' | 'critical' | 'neutral' | 'locked' }) {
  const map = {
    healthy: 'border-device-healthy bg-[#23835B]/10 text-device-healthy',
    attention: 'border-device-attention bg-[#D08A24]/10 text-device-attention',
    critical: 'border-device-critical bg-[#C84B44]/10 text-device-critical',
    neutral: 'border-device-border bg-white text-device-slate',
    locked: 'border-device-locked bg-[#343A38]/10 text-device-locked',
  };
  return <span className={`inline-flex min-h-8 items-center border px-2.5 text-xs font-semibold ${map[tone]}`}>{label}</span>;
}

export function DeviceCard({ device, compact = false }: { device: Device; compact?: boolean }) {
  return (
    <Link href={`/owner/devices/${device.id}`} className="block border border-device-border bg-white p-4 transition hover:border-device-blue">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-device-border bg-device-ice">
            {device.type === 'phone' ? <Smartphone size={20} /> : <Laptop size={20} />}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{device.brand} {device.model}</h3>
            <p className="truncate font-mono text-xs text-device-slate">{device.dnaId}</p>
          </div>
        </div>
        <StatusBadge label={device.status} tone={device.status === 'Good' ? 'healthy' : device.status === 'Attention' ? 'attention' : 'critical'} />
      </div>
      {!compact && (
        <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
          <Metric label="Health" value={`${device.healthScore}`} />
          <Metric label="Type" value={device.type} />
          <Metric label="Since" value={formatDate(device.registeredAt)} />
        </div>
      )}
    </Link>
  );
}

export function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border border-device-border bg-device-ice p-3">
      <p className="text-xs text-device-slate">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold capitalize">{value}</p>
    </div>
  );
}

export function HealthScore({ score, previous, compact = false }: { score: number; previous: number; compact?: boolean }) {
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (score / 100) * circumference;
  const tone = score >= 80 ? '#23835B' : score >= 60 ? '#D08A24' : '#C84B44';
  return (
    <div className={`subtle-blue-field border border-device-darkBorder p-5 text-white ${compact ? '' : 'md:p-6'}`}>
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90">
          <circle cx="50" cy="50" r="42" stroke="#263247" strokeWidth="10" fill="none" />
          <circle cx="50" cy="50" r="42" stroke={tone} strokeWidth="10" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="butt" />
        </svg>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/60">Health score</p>
          <p className="mt-1 text-5xl font-semibold">{score}</p>
          <p className="mt-1 text-sm text-white/70">Previous {previous} · {score - previous >= 0 ? '+' : ''}{score - previous}</p>
        </div>
      </div>
    </div>
  );
}

export function BreakdownPanel({ factors }: { factors: HealthFactor[] }) {
  return (
    <section className="border border-device-border bg-white p-4">
      <h2 className="text-lg font-semibold">Transparent score breakdown</h2>
      <div className="mt-4 space-y-3">
        {factors.map((factor) => (
          <div key={factor.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{factor.label} <span className="text-device-slate">({factor.weight}%)</span></span>
              <span className={factor.direction === 'helped' ? 'text-device-healthy' : factor.direction === 'hurt' ? 'text-device-attention' : 'text-device-slate'}>{factor.value}/{factor.weight}</span>
            </div>
            <div className="mt-2 h-2 border border-device-border bg-device-ice">
              <div className="h-full bg-device-blue" style={{ width: `${(factor.value / factor.weight) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-device-slate">{factor.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AiSummaryPanel({ summary }: { summary: string }) {
  return (
    <section className="border border-device-border bg-white p-4">
      <div className="flex items-center gap-2 text-device-blue">
        <ShieldCheck size={18} />
        <h2 className="text-lg font-semibold text-device-ink">Plain-language condition summary</h2>
      </div>
      <p className="mt-3 text-sm leading-6 text-device-slate">{summary}</p>
      <p className="mt-3 text-xs text-device-slate">This is a transparency signal, not a manufacturer certification.</p>
    </section>
  );
}

export function LockedRecordIndicator() {
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-device-locked"><Lock size={13} /> Permanent record - cannot be edited or deleted.</span>;
}

export function RepairEventCard({ repair, showCorrectionAction = false, onCorrection }: { repair: RepairEvent; showCorrectionAction?: boolean; onCorrection?: (repair: RepairEvent) => void }) {
  const activeWarranty = repair.parts.some((part) => part.warrantyEnds && new Date(part.warrantyEnds).getTime() > Date.now());
  return (
    <article className="border border-device-border bg-white p-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={activeWarranty ? 'Active warranty' : 'No active warranty'} tone={activeWarranty ? 'healthy' : 'neutral'} />
            {repair.parentRepairId && <StatusBadge label="Correction entry" tone="attention" />}
            {repair.explicitlyVerified ? <StatusBadge label={`Verified by ${repair.technicianName}`} tone="healthy" /> : <StatusBadge label="Independent" tone="neutral" />}
          </div>
          <h3 className="mt-3 text-lg font-semibold">{repair.symptom}</h3>
          <p className="mt-1 text-sm text-device-slate">{formatDateTime(repair.createdAt)} · {repair.serviceCentre}</p>
        </div>
        <div className="text-left md:text-right">
          <p className="font-semibold">{formatCurrency(repair.serviceCost)}</p>
          <p className="text-xs text-device-slate">{repair.repairWarrantyDays} day repair warranty</p>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <Info label="Diagnosis" value={repair.diagnosis} />
        <Info label="Action" value={repair.actionTaken} />
        <Info label="Technician-declared part information" value={repair.parts.length ? repair.parts.map((part) => `${part.component} · ${part.partType}`).join(', ') : 'No part replaced'} />
      </dl>
      {repair.correctionNote && <CorrectionRecord note={repair.correctionNote} />}
      <div className="mt-4 flex flex-col gap-3 border-t border-device-border pt-3 md:flex-row md:items-center md:justify-between">
        <LockedRecordIndicator />
        {showCorrectionAction && <button onClick={() => onCorrection?.(repair)} className="min-h-11 border border-device-border px-3 text-sm font-semibold hover:border-device-blue">Add correction</button>}
      </div>
    </article>
  );
}

export function RepairTimeline({ repairs, showCorrectionAction = false, onCorrection }: { repairs: RepairEvent[]; showCorrectionAction?: boolean; onCorrection?: (repair: RepairEvent) => void }) {
  if (!repairs.length) return <EmptyState title="No repairs logged yet" actionLabel="Create first record" href="/scan" />;
  return (
    <div className="relative space-y-4 before:absolute before:left-4 before:top-0 before:h-full before:w-px before:bg-device-border">
      {repairs.map((repair) => (
        <div key={repair.id} className="relative pl-10">
          <span className="absolute left-[9px] top-5 h-3 w-3 border border-device-blue bg-white" />
          <RepairEventCard repair={repair} showCorrectionAction={showCorrectionAction} onCorrection={onCorrection} />
        </div>
      ))}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-device-slate">{label}</dt>
      <dd className="mt-1 leading-6 text-device-ink">{value}</dd>
    </div>
  );
}

export function ComponentRecord({ component, state, partType }: { component: string; state: 'original' | 'replaced'; partType?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-device-border bg-white p-3">
      <div>
        <p className="font-semibold capitalize">{component}</p>
        <p className="text-xs text-device-slate">Technician-declared part type{partType ? `: ${partType}` : ''}</p>
      </div>
      <StatusBadge label={state} tone={state === 'original' ? 'neutral' : 'attention'} />
    </div>
  );
}

export function WarrantyCard({ warranty }: { warranty: WarrantyCardData }) {
  return (
    <article className="border border-device-border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold capitalize">{warranty.component}</h3>
          <p className="mt-1 text-sm text-device-slate">{warranty.deviceName}</p>
        </div>
        <StatusBadge label={warranty.state} tone={warranty.state === 'active' ? 'healthy' : warranty.state === 'expiring' ? 'attention' : 'neutral'} />
      </div>
      <p className="mt-4 text-sm text-device-slate">{warranty.daysRemaining > 0 ? `${warranty.daysRemaining} days remaining` : 'Warranty period ended'}{warranty.endsOn ? ` · ${formatDate(warranty.endsOn)}` : ''}</p>
    </article>
  );
}

export function ActivityItem({ activity }: { activity: Activity }) {
  return (
    <div className="flex gap-3 border-b border-device-border py-4 last:border-b-0">
      <div className={`mt-1 h-2.5 w-2.5 shrink-0 ${activity.tone === 'success' ? 'bg-device-healthy' : activity.tone === 'warning' ? 'bg-device-attention' : 'bg-device-info'}`} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{activity.title}</p>
        <p className="mt-1 text-sm text-device-slate">{activity.detail}</p>
      </div>
      <span className="shrink-0 text-xs text-device-slate">{activity.time}</span>
    </div>
  );
}

export function JobCard({ job }: { job: Job }) {
  return (
    <Link href={`/technician/jobs/${job.id}`} className="block border border-device-border bg-white p-4 hover:border-device-blue">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-device-blue">{job.time}</p>
          <h3 className="mt-2 font-semibold">{job.deviceName}</h3>
          <p className="text-sm text-device-slate">{job.customerName} · {job.category}</p>
        </div>
        <StatusBadge label={job.status} tone={job.status === 'Warranty return' ? 'attention' : 'neutral'} />
      </div>
      <p className="mt-4 text-sm font-semibold">{formatCurrency(job.value)}</p>
    </Link>
  );
}

export function QrCard({ value, title = 'Public passport QR' }: { value: string; title?: string }) {
  return (
    <section className="border border-device-border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        <QrCode size={18} />
      </div>
      <div className="mt-4 flex justify-center border border-device-border bg-device-ice p-4">
        <QRCodeSVG value={value} size={180} bgColor="#F6F8FC" fgColor="#080B11" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <SecondaryButton onClick={() => navigator.clipboard?.writeText(value)}><Copy size={16} /> Copy link</SecondaryButton>
        <SecondaryButton onClick={() => window.print()}><FileText size={16} /> Print</SecondaryButton>
      </div>
    </section>
  );
}

export function PassportHeader({ device }: { device: Device }) {
  return (
    <section className="subtle-blue-field border border-device-darkBorder p-5 text-white md:p-7">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Read-only public record</p>
          <h1 className="mt-3 text-3xl font-semibold md:text-5xl">{device.brand} {device.model}</h1>
          <p className="mt-2 font-mono text-sm text-white/70">{device.dnaId}</p>
        </div>
        <HealthScore score={device.healthScore} previous={device.previousScore} compact />
      </div>
      <p className="mt-5 max-w-3xl text-sm leading-6 text-white/70">This passport is a transparent history record, not a manufacturer certification. Owner contact details and private documents are never shown here.</p>
    </section>
  );
}

export function EmptyState({ title, body, actionLabel, href }: { title: string; body?: string; actionLabel?: string; href?: string }) {
  return (
    <div className="border border-device-border bg-white p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center border border-device-border bg-device-ice"><ClipboardList size={20} /></div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      {body && <p className="mx-auto mt-2 max-w-md text-sm text-device-slate">{body}</p>}
      {actionLabel && href && <div className="mt-5"><PrimaryButton href={href}>{actionLabel} <ArrowRight size={16} /></PrimaryButton></div>}
    </div>
  );
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse border border-device-border bg-white p-4 ${className}`}><div className="h-4 w-2/3 bg-device-border" /><div className="mt-3 h-3 w-full bg-device-border" /><div className="mt-2 h-3 w-5/6 bg-device-border" /></div>;
}

export function EvidencePreview({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between border border-device-border bg-white p-3">
      <span className="flex items-center gap-2 text-sm"><FileText size={16} /> {title}</span>
      <StatusBadge label="read-only" tone="locked" />
    </div>
  );
}

export function CorrectionRecord({ note }: { note: string }) {
  return (
    <div className="mt-4 border border-device-attention bg-[#D08A24]/10 p-3 text-sm">
      <p className="font-semibold text-device-attention">Correction linked to this history</p>
      <p className="mt-1 text-device-ink">{note}</p>
    </div>
  );
}

export function ConfirmationModal({ open, title, body, onCancel, onConfirm }: { open: boolean; title: string; body: string; onCancel: () => void; onConfirm: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-device-midnight/50 p-4 md:items-center md:justify-center">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="w-full max-w-md border border-device-border bg-white p-5">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-device-slate">{body}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
          <PrimaryButton onClick={onConfirm}>Confirm</PrimaryButton>
        </div>
      </motion.div>
    </div>
  );
}

export function FilterChips({ options, value, onChange }: { options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {options.map((option) => (
        <button key={option} onClick={() => onChange(option)} className={`min-h-11 shrink-0 border px-4 text-sm font-semibold ${value === option ? 'border-device-blue bg-device-blue text-white' : 'border-device-border bg-white text-device-ink'}`}>
          {option}
        </button>
      ))}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="flex min-h-12 items-center gap-2 border border-device-border bg-white px-3">
      <Search size={18} className="text-device-slate" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full bg-transparent text-sm outline-none" />
    </label>
  );
}

export function ScannerOverlay({ state }: { state: 'ready' | 'detected' | 'unavailable' | 'invalid' | 'not-found' }) {
  const copy = {
    ready: 'Align the Device DNA QR within the frame.',
    detected: 'Device detected.',
    unavailable: 'Camera unavailable. Manual entry is ready below.',
    invalid: 'Invalid QR. Try a Device DNA code or passport link.',
    'not-found': 'Device not found.',
  }[state];
  return (
    <div className="subtle-blue-field min-h-[420px] border border-device-darkBorder p-5 text-white">
      <div className="flex items-center justify-between">
        <LogoMark compact />
        <StatusBadge label={state === 'ready' ? 'Scanning' : copy} tone={state === 'detected' ? 'healthy' : state === 'ready' ? 'neutral' : 'attention'} />
      </div>
      <div className="relative mx-auto mt-8 h-72 w-full max-w-sm border border-white/25">
        <div className="absolute left-4 top-4 h-10 w-10 border-l-2 border-t-2 border-device-cyan" />
        <div className="absolute right-4 top-4 h-10 w-10 border-r-2 border-t-2 border-device-cyan" />
        <div className="absolute bottom-4 left-4 h-10 w-10 border-b-2 border-l-2 border-device-cyan" />
        <div className="absolute bottom-4 right-4 h-10 w-10 border-b-2 border-r-2 border-device-cyan" />
        <div className="scanner-line absolute left-8 right-8 top-8 h-px bg-device-cyan" />
        <div className="flex h-full items-center justify-center text-center text-sm text-white/65">
          <div>
            <Camera className="mx-auto mb-3" />
            {copy}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FormField({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1 text-xs font-semibold text-device-critical">{error}</p>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`min-h-12 w-full border border-device-border bg-white px-3 text-sm outline-none focus:border-device-blue ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`min-h-12 w-full border border-device-border bg-white px-3 text-sm outline-none focus:border-device-blue ${props.className ?? ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`min-h-28 w-full border border-device-border bg-white px-3 py-3 text-sm outline-none focus:border-device-blue ${props.className ?? ''}`} />;
}

export const Icons = { AlertTriangle, Bell, Check, ChevronRight, Clock, FileText, Laptop, Plus, QrCode, Smartphone, Upload, Wrench, X };
