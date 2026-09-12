import Link from 'next/link';
import { LogoMark } from '@/components/device-dna';
import { dnaCssVariables, ui } from '@/lib/design-tokens';

export default function PrivacyPage() {
  return <PolicyPage title="Privacy" body="Public records show device identity, repair events, component changes, warranties, and the health summary. Owner contact details, private invoices, warranty certificates, and uploaded documents stay private unless explicitly shared." />;
}

function PolicyPage({ title, body }: { title: string; body: string }) {
  return (
    <main className={ui.appPage} style={dnaCssVariables}>
      <div className="mx-auto max-w-3xl px-5 py-6">
        <LogoMark />
        <h1 className="mt-12 text-[32px] font-medium tracking-[-0.03em]">{title}</h1>
        <p className="mt-4 text-[15px] leading-7 text-[var(--dna-text-secondary)]">{body}</p>
        <Link
          href="/"
          className={`${ui.primaryButton} mt-8`}
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
