import Link from 'next/link';
import { LogoMark } from '@/components/device-dna';

export default function TransparencyPage() {
  return (
    <main className="min-h-screen bg-device-ice p-4">
      <div className="mx-auto max-w-3xl rounded-[18px] border border-device-border bg-white p-5">
        <LogoMark />
        <h1 className="mt-8 text-4xl font-bold">Transparency policy</h1>
        <p className="mt-4 text-sm leading-7 text-device-slate">
          Device DNA records are permanent by design. Repair events cannot be
          edited, hidden, or deleted after approval; corrections must be added
          as separate visible history so buyers can see the full trail.
        </p>
        <p className="mt-3 text-sm leading-7 text-device-slate">
          Health Score and AI Market Value Estimate are transparency signals.
          They are not certifications, insurance products, guarantees, or
          manufacturer endorsements.
        </p>
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
