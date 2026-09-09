'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Device, RepairEvent } from '@/lib/mock-data';
import { AppShell, AiSummaryPanel, BreakdownPanel, HealthScore, PageHeader, PrimaryButton, RepairTimeline } from '@/components/device-dna';
import { addCorrection, getDeviceTimeline } from '@/lib/services';

export default function TechnicianDevicePage() {
  const params = useParams<{ id: string }>();
  const [device, setDevice] = useState<Device | null>(null);
  const [repairs, setRepairs] = useState<RepairEvent[]>([]);
  const refresh = () => getDeviceTimeline(params.id).then((result) => { setDevice(result.device); setRepairs(result.repairs); });
  useEffect(() => { refresh(); }, [params.id]);
  async function handleCorrection(repair: RepairEvent) {
    const note = window.prompt('Add a correction note. The original record will remain visible.');
    if (!note?.trim()) return;
    await addCorrection(repair.id, note.trim());
    await refresh();
  }
  if (!device) return <AppShell role="technician"><PageHeader title="Loading device history" /></AppShell>;
  return (
    <AppShell role="technician">
      <PageHeader title={`${device.brand} ${device.model}`} description="Review history before diagnosis. Existing records are read-only and permanent." action={<PrimaryButton href={`/technician/device/${device.id}/add-record`}>Add repair record</PrimaryButton>} />
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4"><HealthScore score={device.healthScore} previous={device.previousScore} /><AiSummaryPanel summary={device.aiSummary} /><BreakdownPanel factors={device.scoreBreakdown} /></div>
        <RepairTimeline repairs={repairs} showCorrectionAction onCorrection={handleCorrection} />
      </div>
    </AppShell>
  );
}
