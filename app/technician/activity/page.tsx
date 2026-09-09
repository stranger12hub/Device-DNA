'use client';

import { useEffect, useState } from 'react';
import { ActivityItem, AppShell, FilterChips, PageHeader } from '@/components/device-dna';
import type { Activity } from '@/lib/mock-data';
import { getActivities } from '@/lib/services';

export default function TechnicianActivityPage() {
  const [items, setItems] = useState<Activity[]>([]);
  const [group, setGroup] = useState('All');
  useEffect(() => { getActivities('technician').then(setItems); }, []);
  const visible = group === 'All' ? items : items.filter((item) => item.group === group);
  return <AppShell role="technician"><PageHeader title="Activity" description="Service actions and correction entries grouped by time." /><FilterChips options={['All', 'Today', 'This week', 'Earlier']} value={group} onChange={setGroup} /><section className="mt-5 border border-device-border bg-white p-4">{visible.map((activity) => <ActivityItem key={activity.id} activity={activity} />)}</section></AppShell>;
}
