import { AppShell, PageHeader, SecondaryButton, StatusBadge } from '@/components/device-dna';

export default function OwnerAccountPage() {
  return (
    <AppShell role="owner">
      <PageHeader title="Account settings" description="Profile, appearance, notifications, and transparent data policy controls." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Profile" lines={['Rhea Nair', 'Owner account', 'rhea.nair@example.com']} />
        <Panel title="Appearance" lines={['Light', 'Dark', 'System']} />
        <Panel title="Notifications" lines={['Warranty expiry reminders', 'New repair record alerts', 'Public passport link copied']} />
        <section className="border border-device-border bg-white p-4">
          <h2 className="text-lg font-semibold">Privacy and transparency</h2>
          <p className="mt-2 text-sm leading-6 text-device-slate">Public passports show device identity, repair history, health score, replaced components, and active warranties. Private owner details and private documents stay hidden.</p>
          <p className="mt-2 text-sm leading-6 text-device-slate">Records cannot be deleted because resale trust depends on permanence. Corrections are added as separate linked entries.</p>
          <div className="mt-4 flex gap-2"><SecondaryButton href="/privacy">Privacy</SecondaryButton><SecondaryButton href="/transparency">Transparency</SecondaryButton></div>
        </section>
      </div>
      <button className="mt-5 min-h-11 border border-device-border bg-white px-4 text-sm font-semibold">Sign out</button>
    </AppShell>
  );
}

function Panel({ title, lines }: { title: string; lines: string[] }) {
  return <section className="border border-device-border bg-white p-4"><h2 className="text-lg font-semibold">{title}</h2><div className="mt-3 flex flex-wrap gap-2">{lines.map((line) => <StatusBadge key={line} label={line} tone="neutral" />)}</div></section>;
}
