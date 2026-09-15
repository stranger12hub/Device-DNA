'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { LogoMark } from '@/components/device-dna';
import { dnaCssVariables, ui } from '@/lib/design-tokens';

export default function TransparencyPage() {
  const router = useRouter();

  return (
    <main className={ui.appPage} style={dnaCssVariables}>
      <div className="mx-auto max-w-3xl px-5 py-6">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="sticky top-4 z-30 mb-6 grid min-h-11 min-w-11 place-items-center rounded-full border border-[var(--dna-border)] bg-[var(--dna-background)] text-[var(--dna-text-primary)]"
        >
          <ChevronLeft size={22} strokeWidth={1.8} />
        </button>
        <LogoMark />
        <h1 className="mt-12 text-[32px] font-medium tracking-[-0.03em]">Transparency policy</h1>
        <p className="mt-4 text-[15px] leading-7 text-[var(--dna-text-secondary)]">
          Device DNA records are permanent by design. Repair events cannot be
          edited, hidden, or deleted after approval; corrections must be added
          as separate visible history so buyers can see the full trail.
        </p>
        <p className="mt-3 text-[15px] leading-7 text-[var(--dna-text-secondary)]">
          Health Score and AI Market Value Estimate are transparency signals.
          They are not certifications, insurance products, guarantees, or
          manufacturer endorsements.
        </p>
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
