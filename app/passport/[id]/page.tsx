'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Device, RepairEvent } from '@/lib/mock-data';
import { AiSummaryPanel, BreakdownPanel, EmptyState, PassportHeader, RepairTimeline, StatusBadge } from '@/components/device-dna';
import { formatDate, getDeviceTimeline } from '@/lib/services';

export default function PublicPassportPage() {
  const params = useParams<{ id: string }>();
  const [device, setDevice] = useState<Device | null | undefined>(undefined);
  const [repairs, setRepairs] = useState<RepairEvent[]>([]);
  useEffect(() => { getDeviceTimeline(params.id).then((result) => { setDevice(result.device); setRepairs(result.repairs); }); }, [params.id]);
  if (device === undefined) return <main className="min-h-screen bg-device-ice p-4">Loading public passport...</main>;
  if (!device) return <main className="min-h-screen bg-device-ice p-4"><EmptyState title="Device not found." body="Check the QR code or enter the Device DNA ID again." href="/scan" actionLabel="Scan again" /></main>;
  const replaced = repairs.flatMap((repair) => repair.parts.map((part) => part.component));
  return (
    <main className="min-h-screen bg-device-ice p-4 text-device-ink">
      <div className="mx-auto max-w-[1180px] space-y-5">
        <PassportHeader device={device} />
        <section className="grid gap-3 md:grid-cols-4">
          <Fact label="Registered" value={formatDate(device.registeredAt)} />
          <Fact label="Repair count" value={repairs.length} />
          <Fact label="Replaced components" value={replaced.length ? replaced.join(', ') : 'None'} />
          <Fact label="Active warranties" value={device.id === 'dev_s24_01' ? '1' : '0'} />
        </section>
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]"><AiSummaryPanel summary={device.aiSummary} /><BreakdownPanel factors={device.scoreBreakdown} /></div>
        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-semibold">Full repair timeline</h2><StatusBadge label="Read-only" tone="locked" /></div>
          <RepairTimeline repairs={repairs} />
        </section>
      </div>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="border border-device-border bg-white p-4"><p className="text-xs text-device-slate">{label}</p><p className="mt-1 text-sm font-semibold capitalize">{value}</p></div>;
}
