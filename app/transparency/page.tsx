import { LogoMark, SecondaryButton } from '@/components/device-dna';

export default function TransparencyPage() {
  return <main className="min-h-screen bg-device-ice p-4"><div className="mx-auto max-w-3xl border border-device-border bg-white p-5"><LogoMark /><h1 className="mt-8 text-4xl font-semibold">Transparency policy</h1><p className="mt-4 text-sm leading-7 text-device-slate">Device DNA records are permanent by design. Repair events cannot be edited, hidden, or deleted after submission; corrections are added as separate linked entries so buyers can see both the original claim and the correction trail.</p><p className="mt-3 text-sm leading-7 text-device-slate">Health Score is a calculated transparency signal based on weighted factors. It is not a certification, quality guarantee, insurance product, or manufacturer endorsement.</p><div className="mt-6"><SecondaryButton href="/role">Back</SecondaryButton></div></div></main>;
}
