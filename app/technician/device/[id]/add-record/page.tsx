'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, Upload } from 'lucide-react';
import { componentSets, type ComponentName, type Device, type PartType, type RepairEvent } from '@/lib/mock-data';
import { AppShell, FormField, HealthScore, Input, PageHeader, PrimaryButton, RepairTimeline, SecondaryButton, Select, Textarea } from '@/components/device-dna';
import { getDeviceTimeline, submitRepairRecord } from '@/lib/services';

export default function AddRecordPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [device, setDevice] = useState<Device | null>(null);
  const [repairs, setRepairs] = useState<RepairEvent[]>([]);
  const [review, setReview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ symptom: '', diagnosis: '', actionTaken: '', component: 'battery' as ComponentName, partNumber: '', partType: 'OEM' as PartType, supplier: '', partCost: '0', warrantyDays: '90', serviceCost: '0', repairWarrantyDays: '30', evidence: '' });

  useEffect(() => { getDeviceTimeline(params.id).then((result) => { setDevice(result.device); setRepairs(result.repairs); }); }, [params.id]);

  async function createRecord() {
    if (!form.symptom.trim()) {
      setError('Symptoms are required.');
      return;
    }
    if (!confirmed) {
      setError('Confirm permanence before submission.');
      return;
    }
    await submitRepairRecord({
      deviceId: params.id,
      symptom: form.symptom,
      diagnosis: form.diagnosis,
      actionTaken: form.actionTaken,
      component: form.component,
      partNumber: form.partNumber,
      partType: form.partType,
      supplier: form.supplier,
      partCost: Number(form.partCost),
      warrantyDays: Number(form.warrantyDays),
      serviceCost: Number(form.serviceCost),
      repairWarrantyDays: Number(form.repairWarrantyDays),
    });
    router.push(`/technician/device/${params.id}`);
  }

  if (!device) return <AppShell role="technician"><PageHeader title="Loading repair form" /></AppShell>;
  return (
    <AppShell role="technician">
      <PageHeader title="Create permanent repair record" description={`${device.brand} ${device.model} · History and score stay visible while you add a new record.`} />
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="space-y-4">
          <HealthScore score={device.healthScore} previous={device.previousScore} />
          {repairs.some((repair) => repair.recurringFault) && <div className="border border-device-attention bg-[#D08A24]/10 p-4 text-sm font-semibold text-device-attention">Recurring-fault warning: review charging history before diagnosis.</div>}
          <RepairTimeline repairs={repairs.slice(0, 2)} />
        </aside>
        <section className="border border-device-border bg-white p-4">
          {!review ? (
            <div className="grid gap-4">
              <FormField label="Symptoms"><Textarea value={form.symptom} onChange={(e) => setForm({ ...form, symptom: e.target.value })} /></FormField>
              <FormField label="Diagnosis"><Textarea value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></FormField>
              <FormField label="Action taken"><Textarea value={form.actionTaken} onChange={(e) => setForm({ ...form, actionTaken: e.target.value })} /></FormField>
              <div className="border border-device-border bg-device-ice p-3 text-sm font-semibold">Technician-declared part information</div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Component"><Select value={form.component} onChange={(e) => setForm({ ...form, component: e.target.value as ComponentName })}>{componentSets[device.type].map((item) => <option key={item}>{item}</option>)}</Select></FormField>
                <FormField label="Part number"><Input value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} /></FormField>
                <FormField label="Part type"><Select value={form.partType} onChange={(e) => setForm({ ...form, partType: e.target.value as PartType })}>{['OEM', 'compatible', 'refurbished', 'customer-provided'].map((item) => <option key={item}>{item}</option>)}</Select></FormField>
                <FormField label="Supplier"><Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></FormField>
                <FormField label="Part cost"><Input type="number" min="0" value={form.partCost} onChange={(e) => setForm({ ...form, partCost: e.target.value })} /></FormField>
                <FormField label="Part warranty days"><Input type="number" min="0" value={form.warrantyDays} onChange={(e) => setForm({ ...form, warrantyDays: e.target.value })} /></FormField>
                <FormField label="Service cost"><Input type="number" min="0" value={form.serviceCost} onChange={(e) => setForm({ ...form, serviceCost: e.target.value })} /></FormField>
                <FormField label="Repair warranty days"><Input type="number" min="0" value={form.repairWarrantyDays} onChange={(e) => setForm({ ...form, repairWarrantyDays: e.target.value })} /></FormField>
              </div>
              <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center border border-dashed border-device-border bg-device-ice p-4 text-sm text-device-slate"><Upload className="mb-2" /> Evidence upload<input type="file" className="sr-only" /></label>
              {error && <p className="text-sm font-semibold text-device-critical">{error}</p>}
              <PrimaryButton onClick={() => setReview(true)}>Review permanent record</PrimaryButton>
            </div>
          ) : (
            <div>
              <Check className="text-device-healthy" />
              <h2 className="mt-3 text-2xl font-semibold">Final review</h2>
              <p className="mt-3 border border-device-attention bg-[#D08A24]/10 p-3 text-sm font-semibold">This repair event will become permanent. It cannot be edited or deleted after submission.</p>
              <label className="mt-4 flex min-h-12 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> I understand this creates a permanent repair record.</label>
              {error && <p className="mt-3 text-sm font-semibold text-device-critical">{error}</p>}
              <div className="mt-5 flex gap-2"><SecondaryButton onClick={() => setReview(false)}>Back</SecondaryButton><PrimaryButton onClick={createRecord}>Create permanent repair record</PrimaryButton></div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
