'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Plus, QrCode } from 'lucide-react';
import { AppShell, ActivityItem, DeviceCard, Metric, PageHeader, PrimaryButton, SecondaryButton, SkeletonBlock } from '@/components/device-dna';
import type { Activity, Device } from '@/lib/mock-data';
import { getActivities, getDeviceTimeline, getDevices } from '@/lib/services';

export default function OwnerHomePage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDevices(), getActivities('owner')]).then(([deviceData, activityData]) => {
      setDevices(deviceData);
      setActivities(activityData);
      setLoading(false);
    });
  }, []);

  const activeWarrantyCount = devices.filter((device) => device.id === 'dev_s24_01').length;
  const attentionCount = devices.filter((device) => device.status !== 'Good').length;

  return (
    <AppShell role="owner">
      <PageHeader
        eyebrow="Good afternoon, Rhea"
        title="Your devices, understood."
        description="A calm view of permanent repair history, warranties, documents, and buyer-safe public passports."
        action={<PrimaryButton href="/owner/devices/new"><Plus size={16} /> Register device</PrimaryButton>}
      />
      {loading ? <SkeletonBlock /> : (
        <div className="grid gap-5">
          <section className="grid gap-3 md:grid-cols-3">
            <Metric label="Registered devices" value={devices.length} />
            <Metric label="Active warranties" value={activeWarrantyCount} />
            <Metric label="Needs attention" value={attentionCount} />
          </section>
          <section className="grid gap-3 md:grid-cols-2">
            <SecondaryButton href="/scan"><QrCode size={16} /> Scan a device</SecondaryButton>
            <SecondaryButton href="/warranties"><AlertTriangle size={16} /> Review warranties</SecondaryButton>
          </section>
          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h2 className="mb-3 text-xl font-semibold">Device list</h2>
              <div className="grid gap-3 md:grid-cols-2">{devices.map((device) => <DeviceCard key={device.id} device={device} />)}</div>
            </div>
            <aside className="space-y-4">
              <div className="border border-device-border bg-white p-4">
                <h2 className="text-lg font-semibold">Active repair status</h2>
                <p className="mt-2 text-sm text-device-slate">Galaxy S24 charging assembly repair completed. Warranty active and public passport updated.</p>
                <div className="mt-4"><SecondaryButton href="/owner/devices/dev_s24_01">Open device</SecondaryButton></div>
              </div>
              <div className="border border-device-border bg-white p-4">
                <h2 className="text-lg font-semibold">Attention needed</h2>
                <p className="mt-2 text-sm text-device-slate">ThinkPad battery warranty has expired. Review before resale or next service visit.</p>
              </div>
            </aside>
          </section>
          <section className="border border-device-border bg-white p-4">
            <h2 className="text-lg font-semibold">Recent activity</h2>
            {activities.map((activity) => <ActivityItem key={activity.id} activity={activity} />)}
          </section>
        </div>
      )}
    </AppShell>
  );
}
