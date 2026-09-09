import { isSupabaseConfigured, supabase } from './supabase';
import type {
  Database,
  Device,
  DeviceScore,
  DeviceTimeline,
  DeviceAccess,
  DocumentRecord,
  Part,
  PartWithWarranty,
  RepairEventWithParts,
  WarrantyRecord,
} from '../types/database';

type DeviceInsert = Database['public']['Tables']['devices']['Insert'];
type RepairEventInsert = Database['public']['Tables']['repair_events']['Insert'];
type PartInsert = Database['public']['Tables']['parts']['Insert'];
type WarrantyRecordInsert =
  Database['public']['Tables']['warranty_records']['Insert'];
type DocumentInsert = Database['public']['Tables']['documents']['Insert'];

export type RegisterDeviceInput = Pick<
  DeviceInsert,
  | 'owner_id'
  | 'device_type'
  | 'brand'
  | 'model'
  | 'serial_imei'
  | 'specs'
  | 'purchase_date'
>;

export type RepairPartInput = {
  componentName: PartInsert['component_name'];
  partNumber?: string | null;
  partType: PartInsert['part_type'];
  supplier?: string | null;
  cost?: number | null;
  warrantyDays?: number;
  evidenceUrl?: string | null;
};

export type SubmitRepairRecordInput = {
  deviceId: string;
  technicianId: string;
  symptom: string;
  diagnosis?: string | null;
  actionTaken: string;
  cost?: number | null;
  parentRepairId?: string | null;
  parts?: RepairPartInput[];
};

export type DocumentType = DocumentInsert['doc_type'];

export async function registerDevice(
  data: RegisterDeviceInput,
): Promise<Device> {
  ensureSupabaseConfigured();

  const { data: device, error } = await supabase
    .from('devices')
    .insert({
      owner_id: data.owner_id,
      device_type: data.device_type,
      brand: data.brand,
      model: data.model,
      serial_imei: data.serial_imei,
      specs: data.specs ?? {},
      purchase_date: data.purchase_date ?? null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return device;
}

export async function submitRepairRecord(
  data: SubmitRepairRecordInput,
): Promise<RepairEventWithParts> {
  ensureSupabaseConfigured();

  const repairInsert: RepairEventInsert = {
    device_id: data.deviceId,
    technician_id: data.technicianId,
    symptom: data.symptom,
    diagnosis: data.diagnosis ?? null,
    action_taken: data.actionTaken,
    cost: data.cost ?? null,
    parent_repair_id: data.parentRepairId ?? null,
  };

  const { data: repairEvent, error: repairError } = await supabase
    .from('repair_events')
    .insert(repairInsert)
    .select()
    .single();

  if (repairError) {
    throw repairError;
  }

  const parts = data.parts?.length
    ? await insertParts(repairEvent.id, data.parts)
    : [];
  const warrantyRecords = parts.length ? await insertWarranties(parts) : [];

  return {
    ...repairEvent,
    parts: attachWarrantyRecords(parts, warrantyRecords),
  };
}

export async function getDeviceTimeline(
  deviceId: string,
): Promise<DeviceTimeline | null> {
  ensureSupabaseConfigured();

  const { data: device, error: deviceError } = await supabase
    .from('devices')
    .select(
      `
        *,
        repair_events (
          *,
          parts (
            *,
            warranty_records (*)
          ),
          profiles:technician_id (*)
        ),
        device_scores (*),
        documents (*),
        device_access (*)
      `,
    )
    .eq('id', deviceId)
    .order('created_at', {
      referencedTable: 'repair_events',
      ascending: false,
    })
    .order('generated_at', {
      referencedTable: 'device_scores',
      ascending: false,
    })
    .maybeSingle()
    .returns<DeviceTimeline | null>();

  if (deviceError) {
    throw deviceError;
  }

  return device;
}

export async function getDeviceScore(
  deviceId: string,
): Promise<DeviceScore | null> {
  ensureSupabaseConfigured();

  const { data, error } = await supabase
    .from('device_scores')
    .select()
    .eq('device_id', deviceId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function recalculateDeviceScore(
  deviceId: string,
): Promise<DeviceScore | null> {
  ensureSupabaseConfigured();

  const timeline = await getDeviceTimeline(deviceId);

  if (!timeline) {
    return null;
  }

  const { error } = await supabase.functions.invoke('insight', {
    body: { timeline },
  });

  if (error) {
    throw error;
  }

  return getDeviceScore(deviceId);
}

export async function uploadDocument(
  deviceId: string,
  file: File,
  docType: DocumentType,
): Promise<DocumentRecord> {
  ensureSupabaseConfigured();

  const filePath = `${deviceId}/${crypto.randomUUID()}-${sanitizeFileName(
    file.name,
  )}`;
  const { error: uploadError } = await supabase.storage
    .from('device-documents')
    .upload(filePath, file, {
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const documentInsert: DocumentInsert = {
    device_id: deviceId,
    doc_type: docType,
    file_url: filePath,
  };
  const { data: document, error: documentError } = await supabase
    .from('documents')
    .insert(documentInsert)
    .select()
    .single();

  if (documentError) {
    throw documentError;
  }

  return document;
}

export async function inviteFamilyMember(
  deviceId: string,
  userId: string,
): Promise<DeviceAccess> {
  ensureSupabaseConfigured();

  const { data, error } = await supabase
    .from('device_access')
    .insert({
      device_id: deviceId,
      user_id: userId,
      access_role: 'family',
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
  technicianId?: string | null;
  loggedBy?: string | null;
  parts?: LogRepairPartInput[];
};

export async function logRepair(
  input: LogRepairInput,
): Promise<RepairEventWithParts> {
  return submitRepairRecord({
    deviceId: input.deviceId,
    technicianId: input.technicianId ?? '',
    symptom: input.symptom,
    diagnosis: input.diagnosis,
    actionTaken: input.actionTaken,
    parts: input.parts?.map((part) => ({
      componentName: 'display',
      partNumber: part.partName,
      partType: part.isGenuine ? 'oem' : 'compatible',
      warrantyDays: part.warrantyDays,
    })),
  });
}

export async function approveRepair(): Promise<void> {
  throw new Error('Repair approval was removed. Submit a correction entry instead.');
}

export async function approveRepairEvent(): Promise<void> {
  return approveRepair();
}

async function insertParts(
  repairEventId: string,
  parts: RepairPartInput[],
): Promise<Part[]> {
  const inserts: PartInsert[] = parts.map((part) => ({
    repair_event_id: repairEventId,
    component_name: part.componentName,
    part_number: part.partNumber ?? null,
    part_type: part.partType,
    supplier: part.supplier ?? null,
    cost: part.cost ?? null,
    warranty_days: part.warrantyDays ?? 0,
    evidence_url: part.evidenceUrl ?? null,
  }));
  const { data, error } = await supabase.from('parts').insert(inserts).select();

  if (error) {
    throw error;
  }

  return data;
}

async function insertWarranties(parts: Part[]): Promise<WarrantyRecord[]> {
  const today = new Date();
  const startDate = toDateOnly(today);
  const inserts: WarrantyRecordInsert[] = parts
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

  if (inserts.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('warranty_records')
    .insert(inserts)
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

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function ensureSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env and restart Vite.',
    );
  }
}
