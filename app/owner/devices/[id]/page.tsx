'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { componentSets, type Device, type DocumentRecord, type RepairEvent } from '@/lib/mock-data';
import { AppShell, AiSummaryPanel, BreakdownPanel, ComponentRecord, EvidencePreview, HealthScore, Metric, PageHeader, QrCard, RepairTimeline, SecondaryButton, StatusBadge } from '@/components/device-dna';
import { formatCurrency, formatDate, getDeviceTimeline, getDocuments } from '@/lib/services';

const tabs = ['Overview', 'History', 'Components', 'Warranties', 'Documents', 'Public Passport'];

export default function DeviceDetailPage() {
  const params = useParams<{ id: string }>();
  const [device, setDevice] = useState<Device | null>(null);
  const [repairs, setRepairs] = useState<RepairEvent[]>([]);
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [tab, setTab] = useState('Overview');

  useEffect(() => {
    getDeviceTimeline(params.id).then(({ device: found, repairs: timeline }) => {
      setDevice(found);
      setRepairs(timeline);
      if (found) getDocuments(found.id).then(setDocs);
    });
  }, [params.id]);

  const totalCost = useMemo(() => repairs.reduce((sum, repair) => sum + repair.serviceCost, 0), [repairs]);
  const replaced = new Set(repairs.flatMap((repair) => repair.parts.map((part) => part.component)));

  if (!device) return <AppShell role="owner"><PageHeader title="Loading device" description="Preparing the permanent record." /></AppShell>;

  return (
    <AppShell role="owner">
      <section className="subtle-blue-field mb-5 border border-device-darkBorder p-5 text-white md:p-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">{device.type} · {device.dnaId}</p>
            <h1 className="mt-3 text-4xl font-semibold md:text-6xl">{device.brand} {device.model}</h1>
            <p className="mt-3 text-sm text-white/70">Registered {formatDate(device.registeredAt)} · Serial/IMEI {device.serialImei}</p>
            <div className="mt-4 flex gap-2"><StatusBadge label={device.status} tone={device.status === 'Good' ? 'healthy' : 'attention'} /><SecondaryButton href={`/passport/${device.id}`}>QR passport</SecondaryButton></div>
          </div>
          <HealthScore score={device.healthScore} previous={device.previousScore} compact />
        </div>
      </section>
      <div className="mb-5 flex gap-2 overflow-x-auto">
        {tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`min-h-11 shrink-0 border px-3 text-sm font-semibold ${tab === item ? 'border-device-blue bg-device-blue text-white' : 'border-device-border bg-white'}`}>{item}</button>)}
      </div>
      {tab === 'Overview' && <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]"><div className="space-y-4"><AiSummaryPanel summary={device.aiSummary} /><BreakdownPanel factors={device.scoreBreakdown} /></div><div className="space-y-4"><Metric label="Latest repair" value={repairs[0]?.symptom ?? 'No repairs'} /><Metric label="Active warranty" value={device.id === 'dev_s24_01' ? 'Charging assembly' : 'None'} /><Metric label="Total repair cost" value={formatCurrency(totalCost)} />{repairs.some((repair) => repair.recurringFault) && <div className="border border-device-attention bg-[#D08A24]/10 p-4 text-sm font-semibold text-device-attention">Recurring-fault warning: charging symptoms appeared more than once.</div>}</div></div>}
      {tab === 'History' && <RepairTimeline repairs={repairs} />}
      {tab === 'Components' && <div className="grid gap-3 md:grid-cols-2">{componentSets[device.type].map((component) => <ComponentRecord key={component} component={component} state={replaced.has(component) ? 'replaced' : 'original'} partType={repairs.flatMap((repair) => repair.parts).find((part) => part.component === component)?.partType} />)}</div>}
      {tab === 'Warranties' && <div className="grid gap-3">{repairs.flatMap((repair) => repair.parts).map((part) => <Metric key={part.id} label={part.component} value={part.warrantyEnds ? formatDate(part.warrantyEnds) : 'No warranty'} />)}</div>}
      {tab === 'Documents' && <div className="grid gap-3 md:grid-cols-2">{docs.map((doc) => <EvidencePreview key={doc.id} title={doc.title} />)}</div>}
      {tab === 'Public Passport' && <div className="grid gap-5 md:grid-cols-[1fr_320px]"><AiSummaryPanel summary={device.aiSummary} /><QrCard value={`${window.location.origin}/passport/${device.id}`} /></div>}
    </AppShell>
  );
}
