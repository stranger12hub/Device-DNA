'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell, EmptyState, JobCard, PageHeader, PrimaryButton, SecondaryButton } from '@/components/device-dna';
import type { Job } from '@/lib/mock-data';
import { getJob } from '@/lib/services';

export default function TechnicianJobDetailPage() {
  const params = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  useEffect(() => { getJob(params.id).then(setJob); }, [params.id]);
  if (job === undefined) return <AppShell role="technician"><PageHeader title="Loading job" /></AppShell>;
  if (!job) return <AppShell role="technician"><EmptyState title="Job not found." href="/technician/jobs" actionLabel="Back to jobs" /></AppShell>;
  return (
    <AppShell role="technician">
      <PageHeader title={job.deviceName} description={`${job.customerName} · ${job.category} · ${job.time}`} action={<PrimaryButton href={`/technician/device/${job.deviceId}/add-record`}>Add repair record</PrimaryButton>} />
      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <JobCard job={job} />
        <section className="border border-device-border bg-white p-4">
          <h2 className="text-lg font-semibold">Next actions</h2>
          <div className="mt-4 grid gap-2"><SecondaryButton href={`/technician/device/${job.deviceId}`}>Review device history</SecondaryButton><PrimaryButton href={`/technician/device/${job.deviceId}/add-record`}>Create permanent record</PrimaryButton></div>
        </section>
      </div>
    </AppShell>
  );
}
