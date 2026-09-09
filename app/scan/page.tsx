'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { AppShell, FormField, Input, PageHeader, PrimaryButton, ScannerOverlay, SecondaryButton } from '@/components/device-dna';
import { lookupDeviceByDnaId } from '@/lib/services';

export default function ScanPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [state, setState] = useState<'ready' | 'detected' | 'unavailable' | 'invalid' | 'not-found'>('ready');

  async function lookup(value = code) {
    const parsed = parseDeviceCode(value);
    if (!parsed) {
      setState('invalid');
      return;
    }
    const device = await lookupDeviceByDnaId(parsed);
    if (!device) {
      setState('not-found');
      return;
    }
    setState('detected');
    window.setTimeout(() => router.push(`/passport/${device.id}`), 350);
  }

  return (
    <AppShell role="owner">
      <PageHeader title="Scan Device DNA" description="Open a public passport by QR, image upload, or manual Device DNA ID." />
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <ScannerOverlay state={state} />
        <section className="border border-device-border bg-white p-4">
          <h2 className="text-lg font-semibold">Manual fallback</h2>
          <p className="mt-2 text-sm text-device-slate">Camera access is simulated in this frontend prototype. Use a mock ID such as DNA-S24-7K2M.</p>
          <div className="mt-4 space-y-3">
            <FormField label="Device DNA ID or passport link"><Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="DNA-S24-7K2M" /></FormField>
            {state === 'not-found' && <p className="text-sm font-semibold text-device-critical">Device not found.</p>}
            {state === 'invalid' && <p className="text-sm font-semibold text-device-critical">Invalid QR or Device DNA ID.</p>}
            <PrimaryButton onClick={() => lookup()}>Find device</PrimaryButton>
            <SecondaryButton onClick={() => lookup('DNA-X1C-3Q8P')}><Upload size={16} /> Upload QR image</SecondaryButton>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function parseDeviceCode(value: string) {
  const clean = value.trim();
  if (!clean) return '';
  try {
    const url = new URL(clean);
    return url.pathname.split('/').filter(Boolean).pop() ?? '';
  } catch {
    return clean;
  }
}
