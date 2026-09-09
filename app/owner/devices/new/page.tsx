'use client';

import { useMemo, useState } from 'react';
import { Check, Download, Laptop, Smartphone } from 'lucide-react';
import { AppShell, FormField, Input, PageHeader, PrimaryButton, QrCard, SecondaryButton, Select } from '@/components/device-dna';
import type { Device, DeviceType } from '@/lib/mock-data';
import { registerDevice } from '@/lib/services';

const steps = ['Type', 'Identity', 'Documents', 'Review', 'Success'];

export default function NewDevicePage() {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<DeviceType>('phone');
  const [form, setForm] = useState({ brand: '', model: '', serialImei: '', color: '', storage: '', processor: '', ram: '', purchaseDate: '' });
  const [error, setError] = useState('');
  const [device, setDevice] = useState<Device | null>(null);

  const specs = useMemo<Record<string, string>>(() => {
    if (type === 'phone') {
      const phoneSpecs: Record<string, string> = { storage: form.storage || 'Not specified' };
      return phoneSpecs;
    }
    const laptopSpecs: Record<string, string> = { processor: form.processor || 'Not specified', ram: form.ram || 'Not specified', storage: form.storage || 'Not specified' };
    return laptopSpecs;
  }, [form, type]);

  async function submit() {
    setError('');
    try {
      const created = await registerDevice({ type, brand: form.brand, model: form.model, serialImei: form.serialImei, color: form.color, specs, purchaseDate: form.purchaseDate });
      setDevice(created);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register device.');
    }
  }

  return (
    <AppShell role="owner">
      <PageHeader title="Register device" description="Five calm steps to create a Device DNA ID. Identity details become part of the permanent record." />
      <div className="mb-5 grid grid-cols-5 border border-device-border bg-white">
        {steps.map((label, index) => <div key={label} className={`min-h-12 border-r border-device-border px-2 py-3 text-center text-xs font-semibold last:border-r-0 ${index <= step ? 'bg-device-blue text-white' : 'text-device-slate'}`}>{label}</div>)}
      </div>
      <section className="border border-device-border bg-white p-4 md:p-6">
        {step === 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            <button onClick={() => setType('phone')} className={`min-h-32 border p-4 text-left ${type === 'phone' ? 'border-device-blue' : 'border-device-border'}`}><Smartphone /><span className="mt-3 block text-xl font-semibold">Phone</span></button>
            <button onClick={() => setType('laptop')} className={`min-h-32 border p-4 text-left ${type === 'laptop' ? 'border-device-blue' : 'border-device-border'}`}><Laptop /><span className="mt-3 block text-xl font-semibold">Laptop</span></button>
          </div>
        )}
        {step === 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Brand"><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></FormField>
            <FormField label="Model"><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></FormField>
            <FormField label={type === 'phone' ? 'IMEI' : 'Serial number'}><Input value={form.serialImei} onChange={(e) => setForm({ ...form, serialImei: e.target.value })} /></FormField>
            {type === 'phone' && <FormField label="Color"><Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></FormField>}
            {type === 'laptop' && <FormField label="Processor"><Input value={form.processor} onChange={(e) => setForm({ ...form, processor: e.target.value })} /></FormField>}
            <FormField label="RAM"><Input value={form.ram} onChange={(e) => setForm({ ...form, ram: e.target.value })} /></FormField>
            <FormField label="Storage"><Input value={form.storage} onChange={(e) => setForm({ ...form, storage: e.target.value })} /></FormField>
            <FormField label="Purchase date"><Input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} /></FormField>
          </div>
        )}
        {step === 2 && <div className="grid gap-4 md:grid-cols-2"><UploadBox title="Invoice upload" /><UploadBox title="Warranty document upload" /><p className="text-sm text-device-slate md:col-span-2">Documents are optional in this prototype and can be skipped.</p></div>}
        {step === 3 && <div className="space-y-3 text-sm"><p className="border border-device-attention bg-[#D08A24]/10 p-3 font-semibold">Device identity details cannot be silently changed after registration. Corrections will be recorded transparently.</p><p>{type} · {form.brand} {form.model} · {form.serialImei}</p>{error && <p className="font-semibold text-device-critical">{error}</p>}</div>}
        {step === 4 && device && <div className="grid gap-5 md:grid-cols-[1fr_320px]"><div><Check className="text-device-healthy" /><h2 className="mt-3 text-2xl font-semibold">Device DNA created</h2><p className="mt-2 font-mono text-device-slate">{device.dnaId}</p><div className="mt-5 flex flex-wrap gap-2"><PrimaryButton href={`/owner/devices/${device.id}`}>Open device record</PrimaryButton><SecondaryButton href="/owner/devices/new">Register another</SecondaryButton></div></div><QrCard value={`${typeof window !== 'undefined' ? window.location.origin : ''}/passport/${device.id}`} title="Passport QR" /></div>}
        {step < 4 && (
          <div className="mt-6 flex flex-col gap-2 md:flex-row md:justify-between">
            <SecondaryButton onClick={() => setStep(Math.max(0, step - 1))}>Back</SecondaryButton>
            {step === 3 ? <PrimaryButton onClick={submit}>Create Device DNA</PrimaryButton> : <PrimaryButton onClick={() => setStep(step + 1)}>Continue</PrimaryButton>}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function UploadBox({ title }: { title: string }) {
  return <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center border border-dashed border-device-border bg-device-ice p-4 text-center text-sm text-device-slate"><Download className="mb-2" />{title}<input type="file" className="sr-only" /></label>;
}
