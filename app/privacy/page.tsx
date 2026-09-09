import { LogoMark, SecondaryButton } from '@/components/device-dna';

export default function PrivacyPage() {
  return <PolicyPage title="Privacy" body="Public records show device identity, repair events, component changes, warranties, and the health summary. Owner contact details, private invoices, warranty certificates, and uploaded documents stay private unless explicitly shared." />;
}

function PolicyPage({ title, body }: { title: string; body: string }) {
  return <main className="min-h-screen bg-device-ice p-4"><div className="mx-auto max-w-3xl border border-device-border bg-white p-5"><LogoMark /><h1 className="mt-8 text-4xl font-semibold">{title}</h1><p className="mt-4 text-sm leading-7 text-device-slate">{body}</p><div className="mt-6"><SecondaryButton href="/role">Back</SecondaryButton></div></div></main>;
}
