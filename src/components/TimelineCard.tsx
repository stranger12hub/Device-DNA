import type { RepairEventWithParts, WarrantyRecord } from '../types/database';

type TimelineCardProps = {
  event: RepairEventWithParts;
};

export default function TimelineCard({ event }: TimelineCardProps) {
  return (
    <article className="grid gap-4 border border-[#171717] bg-[#FAFAFA] p-4 sm:p-5">
      <header className="flex flex-col gap-3 border-b border-[#171717] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase text-[#171717]/50">
            {formatDateTime(event.created_at)}
          </p>
          <h2 className="mt-2 font-['PP_Neue_Montreal','Helvetica_Neue',Helvetica,Arial,sans-serif] text-2xl font-medium leading-tight">
            {event.symptom}
          </h2>
        </div>
        <WarrantyBadge records={getWarrantyRecords(event)} />
      </header>

      <div className="grid gap-4 text-sm leading-6 sm:grid-cols-2">
        <Field label="Diagnosis" value={event.diagnosis || 'Not logged'} />
        <Field label="Action taken" value={event.action_taken || 'Not logged'} />
      </div>

      <div className="grid gap-3">
        <p className="text-xs font-medium uppercase text-[#171717]/50">Parts</p>
        {event.parts.length > 0 ? (
          <div className="grid gap-2">
            {event.parts.map((part) => (
              <div
                className="grid gap-3 border-t border-[#171717] py-3 text-sm sm:grid-cols-[minmax(0,1fr)_120px_160px]"
                key={part.id}
              >
                <span className="font-medium">{part.part_name}</span>
                <span>{part.is_genuine ? 'Genuine' : 'Aftermarket'}</span>
                <span>{getPartWarrantyLabel(part.warranty_records)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="border-t border-[#171717] pt-3 text-sm text-[#171717]/60">
            No part logged
          </p>
        )}
      </div>
    </article>
  );
}

type FieldProps = {
  label: string;
  value: string;
};

function Field({ label, value }: FieldProps) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-[#171717]/50">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}

type WarrantyBadgeProps = {
  records: WarrantyRecord[];
};

function WarrantyBadge({ records }: WarrantyBadgeProps) {
  const activeDays = records
    .filter(isWarrantyActive)
    .map((record) => getDaysRemaining(record.end_date));
  const maxDaysRemaining = activeDays.length > 0 ? Math.max(...activeDays) : 0;
  const isActive = maxDaysRemaining > 0;

  return (
    <span
      className={[
        'inline-flex w-fit border px-3 py-1 text-xs font-medium uppercase',
        isActive
          ? 'border-[#21F1A8] bg-[#21F1A8] text-[#171717]'
          : 'border-[#171717]/25 bg-[#E7E7E2] text-[#171717]/60',
      ].join(' ')}
    >
      {isActive ? `Warranty active / ${maxDaysRemaining}d` : 'Warranty expired'}
    </span>
  );
}

function getWarrantyRecords(event: RepairEventWithParts): WarrantyRecord[] {
  return event.parts.flatMap((part) => part.warranty_records);
}

function getPartWarrantyLabel(records: WarrantyRecord[]): string {
  const activeRecords = records.filter(isWarrantyActive);

  if (activeRecords.length === 0) {
    return records.length > 0 ? 'Warranty expired' : 'No warranty';
  }

  const daysRemaining = Math.max(
    ...activeRecords.map((record) => getDaysRemaining(record.end_date)),
  );

  return `${daysRemaining} days remaining`;
}

function isWarrantyActive(record: WarrantyRecord): boolean {
  return record.status === 'active' && getDaysRemaining(record.end_date) > 0;
}

function getDaysRemaining(endDate: string): number {
  const today = new Date();
  const end = new Date(endDate);

  return Math.max(
    0,
    Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
