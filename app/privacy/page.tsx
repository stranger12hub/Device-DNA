import Link from 'next/link';
import { LogoMark } from '@/components/device-dna';

export default function PrivacyPage() {
  return <PolicyPage title="Privacy" body="Public records show device identity, repair events, component changes, warranties, and the health summary. Owner contact details, private invoices, warranty certificates, and uploaded documents stay private unless explicitly shared." />;
}

function PolicyPage({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-screen bg-device-ice p-4">
      <div className="mx-auto max-w-3xl rounded-[18px] border border-device-border bg-white p-5">
        <LogoMark />
        <h1 className="mt-8 text-4xl font-bold">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-device-slate">{body}</p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center rounded-[16px] border border-device-blue bg-device-blue px-4 text-sm font-bold text-white"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
