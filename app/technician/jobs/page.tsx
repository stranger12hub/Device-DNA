'use client';

import { useEffect, useState } from 'react';
import { AppShell, JobCard, PageHeader, SearchField } from '@/components/device-dna';
import type { Job } from '@/lib/mock-data';
import { getJobs } from '@/lib/services';

export default function TechnicianJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [query, setQuery] = useState('');
  useEffect(() => { getJobs().then(setJobs); }, []);
  const visible = jobs.filter((job) => `${job.deviceName} ${job.customerName} ${job.category}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <AppShell role="technician">
      <PageHeader title="Jobs" description="Today’s queue and warranty returns." />
      <SearchField value={query} onChange={setQuery} placeholder="Search jobs, customers, or repair category" />
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map((job) => <JobCard key={job.id} job={job} />)}</div>
    </AppShell>
  );
}
