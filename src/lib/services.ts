import { getClerkAccessToken, isSupabaseConfigured, supabase } from './supabase';
import type {
  Database,
  Device,
  DeviceScore,
  DeviceTimeline,
  DeviceAccess,
  DocumentRecord,
  Part,
  PartWithWarranty,
  Profile,
  ProfileRole,
  RepairAccessRequest,
  RepairAccessStatus,
  RepairEventWithParts,
  WarrantyRecord,
} from '../types/database';

type DeviceInsert = Database['public']['Tables']['devices']['Insert'];
type RepairEventInsert = Database['public']['Tables']['repair_events']['Insert'];
type PartInsert = Database['public']['Tables']['parts']['Insert'];
type WarrantyRecordInsert =
  Database['public']['Tables']['warranty_records']['Insert'];
type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];

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
export type RepairAccessRequestWithDevice = RepairAccessRequest & {
  devices?: Device | Device[] | null;
};

export type RequestRepairAccessInput = {
  deviceId: string;
  requesterName: string;
  requesterPhone: string;
  shopName: string;
};

type RegisterDeviceResponse = {
  ok: boolean;
  device?: Device;
  error?: string;
};
type DeviceListResponse = {
  ok: boolean;
  devices?: Device[];
  error?: string;
};
type SubmitRepairResponse = {
  ok: boolean;
  repair?: RepairEventWithParts;
  error?: string;
};
type RepairAccessResponse = {
  ok: boolean;
  request?: RepairAccessRequestWithDevice;
  requests?: RepairAccessRequestWithDevice[];
  error?: string;
};
const LOCAL_DEVICE_CACHE_KEY = 'device-dna-local-devices-v3';
const LOCAL_REPAIR_CACHE_KEY = 'device-dna-local-repairs-v3';
const STALE_LOCAL_STORAGE_KEYS = [
  'device-dna-local-devices-v1',
  'device-dna-local-devices-v2',
  'device-dna-local-repairs-v1',
  'device-dna-local-repairs-v2',
  'device-dna-prototype-v1',
  'device-dna-prototype-v2',
];

clearStaleLocalStorage();

export async function getProfile(userId: string): Promise<Profile | null> {
  ensureSupabaseConfigured();

  const { data, error } = await supabase
    .from('profiles')
    .select()
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function ensureProfile(
  userId: string,
  role: ProfileRole,
  displayName?: string | null,
): Promise<Profile> {
  ensureSupabaseConfigured();

  const existing = await getProfile(userId);

  if (existing) {
    return existing;
  }

  const profileInsert: ProfileInsert = {
    id: userId,
    role,
    display_name: displayName?.trim() || null,
  };

  const { data, error } = await supabase
    .from('profiles')
    .insert(profileInsert)
    .select()
    .single();

  if (error) {
    const retry = await getProfile(userId);
    if (retry) {
      return retry;
    }
    throw error;
  }

  return data;
}

export async function updateProfilePhone(
  userId: string,
  phone: string,
): Promise<Profile> {
  ensureSupabaseConfigured();

  const { data, error } = await supabase
    .from('profiles')
    .update({ phone: phone.trim() || null })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export function getServiceErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const details = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
      status?: unknown;
      name?: unknown;
    };
    const parts = [
      details.message,
      details.details,
      details.hint,
      details.code,
      details.status,
      details.name,
    ]
      .filter((value): value is string | number => (
        typeof value === 'string' || typeof value === 'number'
      ))
      .map(String)
      .filter(Boolean);

    if (parts.length) {
      return parts.join(' ');
    }

    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown service error';
    }
  }

  return 'Unknown service error';
}

export async function getDevicesForUser(userId: string): Promise<Device[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const token = await getClerkAccessToken();

  if (token) {
    const response = await fetch('/api/devices', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }).catch(() => null);
    const body: DeviceListResponse = response
      ? (await response.json().catch(() => ({}))) as DeviceListResponse
      : { ok: false };

    if (response?.ok && body.ok) {
      return body.devices ?? [];
    }

    if (response && response.status !== 401) {
      console.warn('Server device list failed, using direct Supabase fallback:', body.error ?? response.statusText);
    }
  }

  const { data, error } = await withTimeout(
    supabase
      .from('devices')
      .select()
      .eq('owner_id', userId)
      .order('created_at', { ascending: false }),
    3500,
  ).catch((error) => ({
    data: null,
    error,
  }));

  if (error) {
    console.warn('Device list failed:', error);
    return [];
  }

  return data ?? [];
}

export async function getRecentVisibleDevices(limit = 24): Promise<Device[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await withTimeout(
    supabase
      .from('devices')
      .select()
      .order('created_at', { ascending: false })
      .limit(limit),
    3500,
  ).catch((error) => ({
    data: null,
    error,
  }));

  if (error) {
    console.warn('Recent device list failed:', error);
    return [];
  }

  return data ?? [];
}

export async function registerDevice(
  data: RegisterDeviceInput,
): Promise<Device> {
  ensureSupabaseConfigured();
  const token = await getClerkAccessToken();

  if (!token) {
    throw new Error('Sign in again and retry registration');
  }

  const response = await fetch('/api/register-device', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      device_type: data.device_type,
      brand: data.brand,
      model: data.model,
      serial_imei: data.serial_imei,
      specs: data.specs ?? {},
      purchase_date: data.purchase_date ?? null,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as RegisterDeviceResponse;

  if (!response.ok || !body.ok || !body.device) {
    throw new Error(body.error || 'Could not register this device');
  }

  return body.device;
}

export async function submitRepairRecord(
  data: SubmitRepairRecordInput,
): Promise<RepairEventWithParts> {
  const resolvedDevice = isUuid(data.deviceId)
    ? null
    : await lookupDevice(data.deviceId).catch(() => null);
  const resolvedDeviceId = resolvedDevice?.id ?? data.deviceId;
  const payload: SubmitRepairRecordInput = {
    ...data,
    deviceId: resolvedDeviceId,
  };

  if (!isUuid(payload.deviceId)) {
    throw new Error('Open a registered Device DNA record before adding a repair log');
  }

  ensureSupabaseConfigured();
  const token = await getClerkAccessToken();

  if (!token) {
    throw new Error('Sign in again and retry repair submission');
  }

  const response = await fetch('/api/submit-repair', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as SubmitRepairResponse;

  if (!response.ok || !body.ok || !body.repair) {
    throw new Error(body.error || 'Could not submit repair record');
  }

  return body.repair;
}

export async function requestRepairAccess(
  input: RequestRepairAccessInput,
): Promise<RepairAccessRequestWithDevice> {
  ensureSupabaseConfigured();
  const token = await getClerkAccessToken();

  if (!token) {
    throw new Error('Sign in before requesting repair access');
  }

  const response = await fetch('/api/repair-access', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const body = (await response.json().catch(() => ({}))) as RepairAccessResponse;

  if (!response.ok || !body.ok || !body.request) {
    throw new Error(normalizeRepairAccessError(body.error || 'Could not request repair access'));
  }

  return body.request;
}

export async function getRepairAccessRequests(): Promise<RepairAccessRequestWithDevice[]> {
  ensureSupabaseConfigured();
  const token = await getClerkAccessToken();

  if (!token) {
    return [];
  }

  const response = await fetch('/api/repair-access', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body = (await response.json().catch(() => ({}))) as RepairAccessResponse;

  if (!response.ok || !body.ok) {
    const message = normalizeRepairAccessError(body.error || 'Could not load repair access requests');
    if (message.includes('Repair access table is missing')) {
      return [];
    }
    throw new Error(message);
  }

  return body.requests ?? [];
}

export async function getRepairAccessRequestsForDevice(
  deviceId: string,
): Promise<RepairAccessRequestWithDevice[]> {
  ensureSupabaseConfigured();
  const token = await getClerkAccessToken();

  if (!token) {
    return [];
  }

  const response = await fetch(`/api/repair-access?deviceId=${encodeURIComponent(deviceId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body = (await response.json().catch(() => ({}))) as RepairAccessResponse;

  if (!response.ok || !body.ok) {
    return [];
  }

  return body.requests ?? [];
}

export async function decideRepairAccessRequest(
  requestId: string,
  decision: Extract<RepairAccessStatus, 'approved' | 'declined'>,
): Promise<boolean> {
  ensureSupabaseConfigured();
  const token = await getClerkAccessToken();

  if (!token) {
    throw new Error('Sign in again');
  }

  const response = await fetch(`/api/repair-access/${requestId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ decision }),
  });
  const body = (await response.json().catch(() => ({}))) as RepairAccessResponse;

  if (!response.ok || !body.ok) {
    throw new Error(normalizeRepairAccessError(body.error || 'Could not update request'));
  }

  return true;
}

export async function getRepairAccessStatus(
  deviceId: string,
  userId: string | null,
): Promise<RepairAccessStatus | null> {
  if (!userId) {
    return null;
  }

  const requests = await getRepairAccessRequestsForDevice(deviceId).catch(() => []);
  const match = requests.find((request) =>
    request.requester_id === userId &&
    request.device_id === deviceId &&
    (request.status === 'pending' || request.status === 'approved')
  );

  return match?.status ?? null;
}

export async function getDeviceTimeline(
  deviceId: string,
): Promise<DeviceTimeline | null> {
  if (!isSupabaseConfigured) {
    return getCachedTimeline(deviceId);
  }

  const token = await getClerkAccessToken();

  if (token) {
    const response = await fetch(`/api/device-timeline/${encodeURIComponent(deviceId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }).catch(() => null);
    const body = response
      ? (await response.json().catch(() => ({}))) as { ok?: boolean; timeline?: DeviceTimeline | null; error?: string }
      : {};

    if (response?.ok && body.ok) {
      return body.timeline ?? null;
    }

    if (response && response.status !== 404 && response.status !== 401) {
      console.warn('Server device timeline failed, using direct Supabase fallback:', body.error ?? response.statusText);
    }
  }

  const { data: device, error: deviceError } = await withTimeout(
    supabase
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
      .returns<DeviceTimeline | null>(),
    4500,
  ).catch((error) => ({
    data: null,
    error,
  }));

  if (deviceError) {
    console.warn('Device timeline failed:', deviceError);
    return await getDeviceTimelineFallback(deviceId);
  }

  if (!device) {
    return await getDeviceTimelineFallback(deviceId);
  }

  return {
    ...device,
    repair_events: device.repair_events ?? [],
  };
}

export async function getPublicPassportTimeline(
  deviceId: string,
): Promise<DeviceTimeline | null> {
  const response = await fetch(`/api/public-passport/${encodeURIComponent(deviceId)}`);
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    timeline?: DeviceTimeline | null;
    error?: string;
  };

  if (response.ok && body.ok) {
    return body.timeline ?? null;
  }

  if (response.status !== 404) {
    console.warn('Public passport API failed:', body.error ?? response.statusText);
  }

  return null;
}

export async function getDeviceScore(
  deviceId: string,
): Promise<DeviceScore | null> {
  if (!isSupabaseConfigured) {
    const localTimeline = getCachedTimeline(deviceId);
    return localTimeline ? getFallbackDeviceScore(localTimeline) : null;
  }

  const { data, error } = await withTimeout(
    supabase
      .from('device_scores')
      .select(
        `
          id,
          device_id,
          health_score,
          score_breakdown,
          ai_summary,
          previous_score,
          market_value_estimate,
          market_value_summary,
          generated_at
        `,
      )
      .eq('device_id', deviceId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    3500,
  ).catch((error) => ({
    data: null,
    error,
  }));

  if (error) {
    console.warn('Device score lookup failed, using fallback:', error);
    const timeline = await getDeviceTimeline(deviceId);
    return timeline ? getFallbackDeviceScore(timeline) : null;
  }

  if (data) {
    const timeline = await getDeviceTimeline(deviceId);
    if (timeline && getApprovedRepairCount(timeline) === 0) {
      return getFallbackDeviceScore(timeline);
    }

    return data;
  }

  const timeline = await getDeviceTimeline(deviceId);
  return timeline ? getFallbackDeviceScore(timeline) : null;
}

export async function recalculateDeviceScore(
  deviceId: string,
): Promise<DeviceScore | null> {
  if (!isSupabaseConfigured) {
    const timeline = getCachedTimeline(deviceId);
    return timeline ? getFallbackDeviceScore(timeline) : null;
  }

  const timeline = await getDeviceTimeline(deviceId);

  if (!timeline) {
    return null;
  }

  const { error } = await supabase.functions.invoke('insight', {
    body: { timeline },
  });

  if (error) {
    console.warn('Insight edge function failed:', error);
    return getFallbackDeviceScore(timeline);
  }

  return (await getDeviceScore(deviceId)) ?? getFallbackDeviceScore(timeline);
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

  return data ?? null;
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

  return data ?? null;
}

export async function lookupDevice(query: string): Promise<Device | null> {
  const clean = query.trim();

  if (!clean) {
    return null;
  }

  if (!isSupabaseConfigured) {
    return lookupCachedDevice(clean);
  }

  const deviceQuery = supabase.from('devices').select();
  const request = isUuid(clean)
    ? deviceQuery.eq('id', clean)
    : deviceQuery.eq('serial_imei', clean);
  const { data, error } = await withTimeout(
    request.maybeSingle(),
    3500,
  ).catch((error) => ({
    data: null,
    error,
  }));

  if (error) {
    console.warn('Device lookup failed:', error);
    return null;
  }

  return data ?? null;
}

export function calculateDeviceHealthScore(
  timeline: DeviceTimeline,
  storedScore?: DeviceScore | null,
): DeviceScore {
  const approvedRepairs = timeline.repair_events.filter(
    (repair) => repair.status === 'approved',
  );
  const approvedTimeline = {
    ...timeline,
    repair_events: approvedRepairs,
  };
  const computed = getFallbackDeviceScore(approvedTimeline);

  return {
    ...computed,
    ai_summary: storedScore?.ai_summary ?? computed.ai_summary,
    previous_score: storedScore?.previous_score ?? null,
    market_value_estimate: storedScore?.market_value_estimate ?? null,
    market_value_summary: storedScore?.market_value_summary ?? null,
    generated_at: storedScore?.generated_at ?? computed.generated_at,
  };
}

export function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== 'number') {
    return 'Not enough data';
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return 'Not recorded';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
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
  throw new Error('Repair logs are added by technicians after owner-approved access.');
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

  return data ?? null;
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

  return data ?? [];
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

function normalizeRepairAccessError(message: string): string {
  if (message.includes('repair_access_requests') || message.includes('schema cache')) {
    return 'Repair access table is missing. Run supabase/migrations/202609110002_repair_access_requests.sql in Supabase SQL Editor.';
  }

  return message;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      globalThis.setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
    }),
  ]);
}

function ensureSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env and restart Next.js.',
    );
  }
}

function clearStaleLocalStorage() {
  if (typeof window === 'undefined') return;

  for (const key of STALE_LOCAL_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith('device-dna-phone-')) {
      window.localStorage.removeItem(key);
    }
  }
}

function cacheDevice(device: Device) {
  if (typeof window === 'undefined') return;
  const devices = mergeDevices([device], getCachedDevices());
  window.localStorage.setItem(LOCAL_DEVICE_CACHE_KEY, JSON.stringify(devices));
}

function cacheRepair(repair: RepairEventWithParts) {
  if (typeof window === 'undefined') return;
  const repairs = mergeRepairs([repair], getCachedRepairs());
  window.localStorage.setItem(LOCAL_REPAIR_CACHE_KEY, JSON.stringify(repairs));
}

function createLocalRepairRecord(data: SubmitRepairRecordInput): RepairEventWithParts {
  const repairId = createLocalId('repair');
  const now = new Date();
  const technicianId = data.technicianId || 'local-technician';
  const parts: PartWithWarranty[] = (data.parts ?? []).map((part, index) => {
    const warrantyDays = Math.max(0, part.warrantyDays ?? 0);
    const partId = createLocalId(`part-${index + 1}`);
    const warrantyEnd = new Date(now);
    warrantyEnd.setDate(warrantyEnd.getDate() + warrantyDays);

    return {
      id: partId,
      repair_event_id: repairId,
      component_name: part.componentName,
      part_number: part.partNumber?.trim() || null,
      part_type: part.partType,
      supplier: part.supplier?.trim() || null,
      cost: part.cost ?? null,
      warranty_days: warrantyDays,
      evidence_url: part.evidenceUrl?.trim() || null,
      warranty_records: warrantyDays > 0
        ? [
            {
              id: createLocalId(`warranty-${index + 1}`),
              part_id: partId,
              start_date: toDateOnly(now),
              end_date: toDateOnly(warrantyEnd),
              status: warrantyEnd >= now ? 'active' : 'expired',
            },
          ]
        : [],
    };
  });

  return {
    id: repairId,
    device_id: data.deviceId,
    technician_id: technicianId,
    symptom: data.symptom.trim(),
    diagnosis: data.diagnosis?.trim() || null,
    action_taken: data.actionTaken.trim(),
    cost: data.cost ?? null,
    parent_repair_id: data.parentRepairId ?? null,
    status: 'pending',
    created_at: now.toISOString(),
    parts,
    profiles: {
      id: technicianId,
      role: 'technician',
      display_name: 'Current technician',
      service_centre: 'Device DNA workshop',
      phone: null,
      created_at: now.toISOString(),
    },
  };
}

function createLocalId(prefix: string): string {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `local-${prefix}-${suffix}`;
}

function getCachedDevices(ownerId?: string): Device[] {
  if (typeof window === 'undefined') return [];

  try {
    const devices = JSON.parse(
      window.localStorage.getItem(LOCAL_DEVICE_CACHE_KEY) ?? '[]',
    ) as Device[];

    return ownerId ? devices.filter((device) => device.owner_id === ownerId) : devices;
  } catch {
    return [];
  }
}

function getCachedRepairs(deviceId?: string): RepairEventWithParts[] {
  if (typeof window === 'undefined') return [];

  try {
    const repairs = JSON.parse(
      window.localStorage.getItem(LOCAL_REPAIR_CACHE_KEY) ?? '[]',
    ) as RepairEventWithParts[];

    return deviceId
      ? repairs.filter((repair) => repair.device_id === deviceId)
      : repairs;
  } catch {
    return [];
  }
}

function getCachedTimeline(deviceId: string): DeviceTimeline | null {
  const device = lookupCachedDevice(deviceId);

  if (!device) {
    return null;
  }

  return {
    ...device,
    repair_events: getCachedRepairs(device.id),
    device_scores: [],
    documents: [],
    device_access: [],
  };
}

async function getDeviceTimelineFallback(deviceId: string): Promise<DeviceTimeline | null> {
  const device = await getDeviceByIdOrSerial(deviceId);

  if (!device) {
    return null;
  }

  const { data: repairs, error: repairError } = await withTimeout(
    supabase
      .from('repair_events')
      .select()
      .eq('device_id', device.id)
      .order('created_at', { ascending: false }),
    2500,
  ).catch((error) => ({ data: null, error }));

  if (repairError) {
    console.warn('Fallback repair lookup failed:', repairError);
  }

  const repairRows = repairs ?? [];
  const repairIds = repairRows.map((repair) => repair.id);
  const parts = repairIds.length
    ? await getPartsForRepairs(repairIds)
    : [];
  const warranties = parts.length
    ? await getWarrantiesForParts(parts.map((part) => part.id))
    : [];
  const profiles = repairRows.length
    ? await getProfilesForRepairs(repairRows.map((repair) => repair.technician_id))
    : [];
  const repairEvents: RepairEventWithParts[] = repairRows.map((repair) => ({
    ...repair,
    parts: parts
      .filter((part) => part.repair_event_id === repair.id)
      .map((part) => ({
        ...part,
        warranty_records: warranties.filter((record) => record.part_id === part.id),
      })),
    profiles: profiles.find((profile) => profile.id === repair.technician_id) ?? null,
  }));

  const { data: scores } = await withTimeout(
    supabase
      .from('device_scores')
      .select()
      .eq('device_id', device.id)
      .order('generated_at', { ascending: false }),
    2500,
  ).catch(() => ({ data: null }));

  return {
    ...device,
    repair_events: repairEvents,
    device_scores: scores ?? [],
    documents: [],
    device_access: [],
  };
}

async function getDeviceByIdOrSerial(query: string): Promise<Device | null> {
  const clean = query.trim();

  if (!clean) {
    return null;
  }

  const request = supabase
    .from('devices')
    .select();
  const { data, error } = await withTimeout(
    (isUuid(clean) ? request.eq('id', clean) : request.eq('serial_imei', clean))
      .maybeSingle(),
    2500,
  ).catch((error) => ({ data: null, error }));

  if (error) {
    console.warn('Fallback device lookup failed:', error);
    return null;
  }

  return data ?? null;
}

async function getPartsForRepairs(repairIds: string[]): Promise<Part[]> {
  const { data, error } = await withTimeout(
    supabase
      .from('parts')
      .select()
      .in('repair_event_id', repairIds),
    2500,
  ).catch((error) => ({ data: null, error }));

  if (error) {
    console.warn('Fallback parts lookup failed:', error);
    return [];
  }

  return data ?? [];
}

async function getWarrantiesForParts(partIds: string[]): Promise<WarrantyRecord[]> {
  const { data, error } = await withTimeout(
    supabase
      .from('warranty_records')
      .select()
      .in('part_id', partIds),
    2500,
  ).catch((error) => ({ data: null, error }));

  if (error) {
    console.warn('Fallback warranty lookup failed:', error);
    return [];
  }

  return data ?? [];
}

async function getProfilesForRepairs(profileIds: string[]): Promise<Profile[]> {
  const uniqueIds = [...new Set(profileIds.filter(Boolean))];

  if (!uniqueIds.length) {
    return [];
  }

  const { data, error } = await withTimeout(
    supabase
      .from('profiles')
      .select()
      .in('id', uniqueIds),
    2500,
  ).catch((error) => ({ data: null, error }));

  if (error) {
    console.warn('Fallback profile lookup failed:', error);
    return [];
  }

  return data ?? [];
}

function lookupCachedDevice(query: string): Device | null {
  const clean = query.trim().toLowerCase();

  if (!clean) {
    return null;
  }

  return getCachedDevices().find((device) => (
    device.id.toLowerCase() === clean ||
    device.serial_imei.toLowerCase() === clean
  )) ?? null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mergeDevices(primary: Device[], secondary: Device[]): Device[] {
  const byId = new Map<string, Device>();

  for (const device of [...secondary, ...primary]) {
    byId.set(device.id, device);
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function mergeRepairs(
  primary: RepairEventWithParts[],
  secondary: RepairEventWithParts[],
): RepairEventWithParts[] {
  const byId = new Map<string, RepairEventWithParts>();

  for (const repair of [...secondary, ...primary]) {
    byId.set(repair.id, repair);
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function getFallbackDeviceScore(timeline: DeviceTimeline): DeviceScore {
  const repairCount = getApprovedRepairCount(timeline);
  const hasRepairs = repairCount > 0;
  const approvedRepairs = timeline.repair_events.filter(
    (repair) => repair.status === 'approved',
  );
  const parts = approvedRepairs.flatMap((repair) => repair.parts);
  const replacedCriticalParts = parts.filter((part) => [
      'motherboard',
      'display',
      'battery',
      'storage',
      'charging_assembly',
      'charging_port',
    ].includes(part.component_name)).length;
  const nonPreferredParts = parts.filter((part) =>
    ['compatible', 'refurbished', 'customer_provided'].includes(part.part_type),
  ).length;
  const recurringGroups = new Map<string, number>();

  for (const repair of approvedRepairs) {
    const key = normalizeRepairIssue(
      [repair.symptom, repair.diagnosis, repair.action_taken].join(' '),
    );
    if (key) {
      recurringGroups.set(key, (recurringGroups.get(key) ?? 0) + 1);
    }
  }

  const recurringHits = [...recurringGroups.values()].filter((count) => count > 1).length;
  const deviceAge = scoreDeviceAgeFromTimeline(timeline);
  const repairFrequency = hasRepairs ? Math.max(20, 100 - repairCount * 16) : 100;
  const recurringFaults = hasRepairs ? Math.max(25, 100 - recurringHits * 30) : 100;
  const criticalComponentHistory = hasRepairs
    ? Math.max(20, 100 - replacedCriticalParts * 14 - nonPreferredParts * 8)
    : 100;
  const healthScore = hasRepairs
    ? Math.round(
        deviceAge * 0.15 +
        repairFrequency * 0.35 +
        recurringFaults * 0.30 +
        criticalComponentHistory * 0.20,
      )
    : 100;

  return {
    id: `local-score-${timeline.id}`,
    device_id: timeline.id,
    health_score: healthScore,
    score_breakdown: {
      deviceAge,
      repairFrequency,
      recurringFaults,
      criticalComponentHistory,
      warrantyEvidenceCompleteness: 100,
    },
    ai_summary: hasRepairs
      ? buildLocalHealthSummary(repairCount, recurringHits, replacedCriticalParts, nonPreferredParts)
      : 'No faults or replaced parts are recorded for this device. Until a repair is logged, Device DNA treats the device as full health.',
    previous_score: null,
    market_value_estimate: null,
    market_value_summary: null,
    generated_at: new Date().toISOString(),
  };
}

function getApprovedRepairCount(timeline: DeviceTimeline): number {
  return timeline.repair_events.filter((repair) => repair.status === 'approved').length;
}

function scoreDeviceAgeFromTimeline(timeline: DeviceTimeline): number {
  const anchor = timeline.purchase_date || timeline.created_at;
  const ageDays = Math.max(
    0,
    Math.ceil((Date.now() - new Date(anchor).getTime()) / (1000 * 60 * 60 * 24)),
  );

  if (ageDays <= 365) return 100;
  if (ageDays <= 730) return 85;
  if (ageDays <= 1095) return 70;
  if (ageDays <= 1460) return 55;
  return 40;
}

function normalizeRepairIssue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 3)
    .join(' ');
}

function buildLocalHealthSummary(
  repairCount: number,
  recurringHits: number,
  criticalPartCount: number,
  nonPreferredPartCount: number,
): string {
  const factors: string[] = [`${repairCount} approved repair ${repairCount === 1 ? 'record' : 'records'}`];

  if (recurringHits) {
    factors.push('recurring issue patterns');
  }

  if (criticalPartCount) {
    factors.push(`${criticalPartCount} critical component ${criticalPartCount === 1 ? 'replacement' : 'replacements'}`);
  }

  if (nonPreferredPartCount) {
    factors.push('non-OEM or refurbished part history');
  }

  return `This score is calculated from ${factors.join(', ')}. Fewer repeated faults and fewer critical component replacements keep the Device DNA score higher.`;
}
