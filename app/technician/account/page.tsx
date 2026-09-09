import { AppShell, PageHeader, SecondaryButton, StatusBadge } from '@/components/device-dna';

export default function TechnicianAccountPage() {
  return (
    <AppShell role="technician">
      <PageHeader title="Technician account" description="Profile, shop presence, notifications, and transparency controls." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Profile" lines={['Arun Kumar', 'Metro Device Care', 'Technician']} />
        <Panel title="Appearance" lines={['Light', 'Dark', 'System']} />
        <Panel title="Notifications" lines={['Warranty return alerts', 'Customer updates', 'Daily job summary']} />
        <section className="border border-device-darkBorder bg-device-midnight p-4 text-white">
          <h2 className="text-lg font-semibold">Grow with Device DNA Pro</h2>
          <p className="mt-2 text-sm leading-6 text-white/70">Marketing-only prototype card: unlimited records, analytics, branded invoices, multi-staff, reminders, and data export.</p>
        </section>
      </div>
      <div className="mt-5 flex gap-2"><SecondaryButton href="/privacy">Privacy</SecondaryButton><SecondaryButton href="/transparency">Transparency</SecondaryButton></div>
      <button className="mt-5 min-h-11 border border-device-border bg-white px-4 text-sm font-semibold">Sign out</button>
    </AppShell>
  );
}

function Panel({ title, lines }: { title: string; lines: string[] }) {
  return <section className="border border-device-border bg-white p-4"><h2 className="text-lg font-semibold">{title}</h2><div className="mt-3 flex flex-wrap gap-2">{lines.map((line) => <StatusBadge key={line} label={line} tone="neutral" />)}</div></section>;
}
