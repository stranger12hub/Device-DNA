'use client';

import { useEffect, useMemo, useState } from 'react';
import { Grid2X2, List, Plus } from 'lucide-react';
import { AppShell, DeviceCard, EmptyState, FilterChips, PageHeader, PrimaryButton, SearchField, SecondaryButton } from '@/components/device-dna';
import type { Device } from '@/lib/mock-data';
import { getDevices } from '@/lib/services';

const filters = ['All', 'Phones', 'Laptops', 'Good', 'Attention', 'Critical'];

export default function OwnerDevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [grid, setGrid] = useState(true);

  useEffect(() => { getDevices().then(setDevices); }, []);

  const visible = useMemo(() => devices.filter((device) => {
    const text = `${device.brand} ${device.model} ${device.serialImei} ${device.dnaId}`.toLowerCase();
    const matchesQuery = text.includes(query.toLowerCase());
    const matchesFilter = filter === 'All' || (filter === 'Phones' && device.type === 'phone') || (filter === 'Laptops' && device.type === 'laptop') || device.status === filter;
    return matchesQuery && matchesFilter;
  }), [devices, filter, query]);

  return (
    <AppShell role="owner">
      <PageHeader title="Devices" description="Search, filter, and open permanent passports for every registered phone and laptop." action={<PrimaryButton href="/owner/devices/new"><Plus size={16} /> Register first device</PrimaryButton>} />
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <SearchField value={query} onChange={setQuery} placeholder="Search by model, serial, IMEI, or Device DNA ID" />
        <div className="grid grid-cols-2 gap-2">
          <SecondaryButton onClick={() => setGrid(true)}><Grid2X2 size={16} /> Grid</SecondaryButton>
          <SecondaryButton onClick={() => setGrid(false)}><List size={16} /> List</SecondaryButton>
        </div>
      </div>
      <FilterChips options={filters} value={filter} onChange={setFilter} />
      <div className={grid ? 'mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3' : 'mt-5 grid gap-3'}>
        {!devices.length && <EmptyState title="No devices registered yet." actionLabel="Register first device" href="/owner/devices/new" />}
        {devices.length > 0 && !visible.length && <EmptyState title="No matching devices." body="Try another search term or clear the selected filter." />}
        {visible.map((device) => <DeviceCard key={device.id} device={device} compact={!grid} />)}
      </div>
    </AppShell>
  );
}
