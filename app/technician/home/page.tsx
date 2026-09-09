'use client';

import { useEffect, useState } from 'react';
import { BarChart3, ClipboardPlus, History, ShieldCheck, Upload, Users, Wrench } from 'lucide-react';
import { AppShell, JobCard, Metric, PageHeader, PrimaryButton, SecondaryButton } from '@/components/device-dna';
import type { Job } from '@/lib/mock-data';
import { getJobs } from '@/lib/services';

export default function TechnicianHomePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  useEffect(() => { getJobs().then(setJobs); }, []);
  return (
    <AppShell role="technician">
      <PageHeader eyebrow="Metro Device Care" title="Repairs that build trust." description="Create permanent records, review history before diagnosis, and reduce warranty returns." action={<PrimaryButton href="/scan"><ClipboardPlus size={16} /> Start from scan</PrimaryButton>} />
      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Completed jobs" value="42" />
        <Metric label="Avg repair value" value="₹2,840" />
        <Metric label="Common category" value="Charging" />
        <Metric label="Warranty returns" value="3" />
      </section>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <h2 className="mb-3 text-xl font-semibold">Today's jobs</h2>
          <div className="grid gap-3">{jobs.map((job) => <JobCard key={job.id} job={job} />)}</div>
        </section>
        <aside className="space-y-4">
          <section className="border border-device-border bg-white p-4">
            <h2 className="text-lg font-semibold">Recent customers</h2>
            <p className="mt-2 text-sm text-device-slate">Rhea Nair, Karan Mehta, Asha Menon</p>
          </section>
          <section className="border border-device-border bg-white p-4">
            <h2 className="text-lg font-semibold">Technician benefits</h2>
            <div className="mt-3 grid gap-2 text-sm text-device-slate">
              {['Digital job cards', 'History-before-diagnosis', 'Repair-status management', 'Customer history', 'Digital repair warranties', 'Warranty-return detection', 'Analytics'].map((item) => <p key={item} className="flex items-center gap-2"><ShieldCheck size={15} className="text-device-blue" /> {item}</p>)}
            </div>
          </section>
          <section className="border border-device-darkBorder bg-device-midnight p-4 text-white">
            <h2 className="text-lg font-semibold">Grow with Device DNA Pro</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">Unlimited records, analytics, branded invoices, multi-staff, reminders, and data export.</p>
            <div className="mt-4"><SecondaryButton href="/technician/account"><BarChart3 size={16} /> Learn more</SecondaryButton></div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
