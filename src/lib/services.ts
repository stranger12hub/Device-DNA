import { isSupabaseConfigured, supabase } from './supabase';
import type {
  Database,
  Device,
  DeviceTimeline,
  Part,
  PartWithWarranty,
  RepairEventWithParts,
  WarrantyRecord,
} from '../types/database';

type DeviceInsert = Database['public']['Tables']['devices']['Insert'];
type RepairEventInsert = Database['public']['Tables']['repair_events']['Insert'];
type PartInsert = Database['public']['Tables']['parts']['Insert'];
type WarrantyRecordInsert = Database['public']['Tables']['warranty_records']['Insert'];

export type RegisterDeviceInput = Pick<
  DeviceInsert,
  'serial_imei' | 'brand' | 'model'
> & {
  device_type?: DeviceInsert['device_type'];
};

export type LogRepairPartInput = {
  partName: string;
  isGenuine?: boolean;
  warrantyDays?: number;
};

export type LogRepairInput = {
  deviceId: string;
  symptom: string;
  diagnosis?: string | null;
  actionTaken: string;
  loggedBy?: string | null;
  parts?: LogRepairPartInput[];
};

export async function registerDevice(
  input: RegisterDeviceInput,
): Promise<Device> {
  ensureSupabaseConfigured();

  const { data, error } = await supabase
    .from('devices')
    .insert({
      serial_imei: input.serial_imei,
      device_type: input.device_type ?? 'phone',
      brand: input.brand,
      model: input.model,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function lookupDeviceBySerial(
  serialImei: string,
): Promise<Device | null> {
  ensureSupabaseConfigured();

  const { data, error } = await supabase
    .from('devices')
    .select()
    .eq('serial_imei', serialImei)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function logRepair(
  input: LogRepairInput,
): Promise<RepairEventWithParts> {
  ensureSupabaseConfigured();

  const repairEventInsert: RepairEventInsert = {
    device_id: input.deviceId,
    symptom: input.symptom,
    diagnosis: input.diagnosis ?? null,
    action_taken: input.actionTaken,
    logged_by: input.loggedBy ?? null,
  };

  const { data: repairEvent, error: repairError } = await supabase
    .from('repair_events')
    .insert(repairEventInsert)
    .select()
    .single();

  if (repairError) {
    throw repairError;
  }

  const partInputs = input.parts ?? [];

  if (partInputs.length === 0) {
    return {
      ...repairEvent,
      parts: [],
    };
  }

  const partInserts: PartInsert[] = partInputs.map((part) => ({
    repair_event_id: repairEvent.id,
    part_name: part.partName,
    is_genuine: part.isGenuine ?? true,
    warranty_days: part.warrantyDays ?? 0,
  }));

  const { data: parts, error: partsError } = await supabase
    .from('parts')
    .insert(partInserts)
    .select();

  if (partsError) {
    throw partsError;
  }

  const warrantyInserts = buildWarrantyRecords(parts);
  const warrantyRecords =
    warrantyInserts.length > 0
      ? await insertWarrantyRecords(warrantyInserts)
      : [];

  return {
    ...repairEvent,
    parts: attachWarrantyRecords(parts, warrantyRecords),
  };
}

export async function getDeviceTimeline(
  serialOrId: string,
): Promise<DeviceTimeline | null> {
  ensureSupabaseConfigured();

  const device = await lookupDevice(serialOrId);

  if (!device) {
    return null;
  }

  const { data: repairEvents, error } = await supabase
    .from('repair_events')
    .select(
      `
        *,
        parts (
          *,
          warranty_records (*)
        )
      `,
    )
    .eq('device_id', device.id)
    .order('created_at', { ascending: false })
    .returns<RepairEventWithParts[]>();

  if (error) {
    throw error;
  }

  return {
    ...device,
    repair_events: repairEvents,
  };
}

async function lookupDevice(serialOrId: string): Promise<Device | null> {
  if (isUuid(serialOrId)) {
    const { data, error } = await supabase
      .from('devices')
      .select()
      .eq('id', serialOrId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  return lookupDeviceBySerial(serialOrId);
}

function buildWarrantyRecords(parts: Part[]): WarrantyRecordInsert[] {
  const today = new Date();
  const startDate = toDateOnly(today);

  return parts
    .filter((part) => part.warranty_days > 0)
    .map((part) => {
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + part.warranty_days);

      return {
        part_id: part.id,
        start_date: startDate,
        end_date: toDateOnly(endDate),
        status: 'active',
      };
    });
}

async function insertWarrantyRecords(
  records: WarrantyRecordInsert[],
): Promise<WarrantyRecord[]> {
  const { data, error } = await supabase
    .from('warranty_records')
    .insert(records)
    .select();

  if (error) {
    throw error;
  }

  return data;
}

function attachWarrantyRecords(
  parts: Part[],
  warrantyRecords: WarrantyRecord[],
): PartWithWarranty[] {
  return parts.map((part) => ({
    ...part,
    warranty_records: warrantyRecords.filter(
      (record) => record.part_id === part.id,
    ),
  }));
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function ensureSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env and restart Vite.',
    );
  }
}
