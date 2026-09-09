'use client';

import { useEffect, useState } from 'react';
import { AppShell, EmptyState, PageHeader, WarrantyCard } from '@/components/device-dna';
import type { WarrantyCardData } from '@/lib/mock-data';
import { getWarranties } from '@/lib/services';

export default function WarrantiesPage() {
  const [warranties, setWarranties] = useState<WarrantyCardData[]>([]);
  useEffect(() => { getWarranties().then(setWarranties); }, []);
  return (
    <AppShell role="owner">
      <PageHeader title="Warranties" description="Part and repair warranties grouped into one buyer-safe view." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{warranties.length ? warranties.map((warranty) => <WarrantyCard key={warranty.id} warranty={warranty} />) : <EmptyState title="No warranties yet." />}</div>
    </AppShell>
  );
}
