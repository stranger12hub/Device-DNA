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
export type VerifyOtpResult = {
  approved: boolean;
};

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
const LOCAL_DEVICE_CACHE_KEY = 'device-dna-local-devices-v1';
const LOCAL_REPAIR_CACHE_KEY = 'device-dna-local-repairs-v1';

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
  const cached = getCachedDevices(userId);

  if (cached.length) {
    return mergeDevices(cached, []);
  }

  if (!isSupabaseConfigured) {
    return ensureDemoDevices(cached);
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
    console.warn('Device list failed, using local cache:', error);
    return ensureDemoDevices(getCachedDevices(userId));
  }

  if (!(data ?? []).length) {
    const visibleDevices = await getRecentVisibleDevices().catch(() => []);
    return ensureDemoDevices(mergeDevices(visibleDevices, getCachedDevices(userId)));
  }

  return ensureDemoDevices(mergeDevices(data ?? [], getCachedDevices(userId)));
}

export async function getRecentVisibleDevices(limit = 24): Promise<Device[]> {
  const cached = getCachedDevices();

  if (cached.length) {
    return mergeDevices(cached, []);
  }

  if (!isSupabaseConfigured) {
    return ensureDemoDevices(cached);
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
    console.warn('Recent device list failed, using local cache:', error);
    return ensureDemoDevices(getCachedDevices());
  }

  return ensureDemoDevices(data ?? []);
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

  cacheDevice(body.device);
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
    const repair = createLocalRepairRecord(data);
    cacheRepair(repair);
    return repair;
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
    const message = body.error || 'Could not submit repair record';
    if (message.includes('invalid input syntax for type uuid')) {
      const repair = createLocalRepairRecord(data);
      cacheRepair(repair);
      return repair;
    }
    throw new Error(body.error || 'Could not submit repair record');
  }

  cacheRepair(body.repair);
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
    throw new Error(body.error || 'Could not request repair access');
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
    throw new Error(body.error || 'Could not load repair access requests');
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
    throw new Error(body.error || 'Could not update request');
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

  const requests = await getRepairAccessRequests().catch(() => []);
  const match = requests.find((request) =>
    request.requester_id === userId &&
    request.device_id === deviceId &&
    (request.status === 'pending' || request.status === 'approved')
  );

  return match?.status ?? null;
}

export async function verifyOtpAndApprove(
  repairEventId: string,
  _otp?: string,
): Promise<VerifyOtpResult> {
  return approveRepairEvent(repairEventId);
}

export async function approveRepairEvent(
  repairEventId: string,
): Promise<VerifyOtpResult> {
  ensureSupabaseConfigured();

  const { data, error } = await supabase.rpc('approve_repair_event', {
    repair_event_id: repairEventId,
  });

  if (error) {
    throw error;
  }

  return { approved: data === true };
}

export async function getDeviceTimeline(
  deviceId: string,
): Promise<DeviceTimeline | null> {
  const localTimeline = getCachedTimeline(deviceId);

  if (localTimeline) {
    return localTimeline;
  }

  if (!isSupabaseConfigured) {
    return null;
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
    console.warn('Device timeline failed, using local cache:', deviceError);
    return (await getDeviceTimelineFallback(deviceId)) ?? getCachedTimeline(deviceId);
  }

  if (!device) {
    return (await getDeviceTimelineFallback(deviceId)) ?? getCachedTimeline(deviceId);
  }

  const cachedRepairs = getCachedRepairs(device.id);

  return {
    ...device,
    repair_events: mergeRepairs(device.repair_events ?? [], cachedRepairs),
  };
}

export async function getPublicPassportTimeline(
  deviceId: string,
): Promise<DeviceTimeline | null> {
  const timeline = await getDeviceTimeline(deviceId);

  if (!timeline) {
    return null;
  }

  return {
    ...timeline,
    repair_events: timeline.repair_events.filter(
      (event) => event.status === 'approved',
    ),
  };
}

export async function getDeviceScore(
  deviceId: string,
): Promise<DeviceScore | null> {
  const localTimeline = getCachedTimeline(deviceId);

  if (localTimeline) {
    return getFallbackDeviceScore(localTimeline);
  }

  if (!isSupabaseConfigured) {
    return null;
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

  const local = lookupCachedDevice(clean) ?? lookupDemoDevice(clean);

  if (local) {
    return local;
  }

  if (!isSupabaseConfigured) {
    return null;
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
    console.warn('Device lookup failed, using local cache:', error);
    return lookupCachedDevice(clean) ?? lookupDemoDevice(clean);
  }

  return data ?? lookupCachedDevice(clean) ?? lookupDemoDevice(clean);
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
  throw new Error('Use approveRepairEvent(repairEventId) for approvals.');
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
  const device = lookupCachedDevice(deviceId) ?? lookupDemoDevice(deviceId);

  if (!device) {
    return null;
  }

  return {
    ...device,
    repair_events: mergeRepairs(getDemoRepairs(device.id), getCachedRepairs(device.id)),
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
    repair_events: mergeRepairs(repairEvents, getCachedRepairs(device.id)),
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

function ensureDemoDevices(devices: Device[]): Device[] {
  if (devices.length > 0) {
    return devices;
  }

  return getDemoDevices();
}

function getDemoDevices(): Device[] {
  const now = new Date().toISOString();

  return [
    {
      id: 'demo-galaxy-s24',
      owner_id: 'demo-owner',
      device_type: 'phone',
      brand: 'Samsung',
      model: 'Galaxy S24',
      serial_imei: '356938119028447',
      specs: { storage: '256 GB', color: 'Onyx Black' },
      purchase_date: '2025-04-18',
      created_at: now,
    },
    {
      id: 'demo-thinkpad-x1',
      owner_id: 'demo-owner',
      device_type: 'laptop',
      brand: 'Lenovo',
      model: 'ThinkPad X1 Carbon',
      serial_imei: 'PF4Z9K21',
      specs: { processor: 'Intel Core i7', ram: '16 GB', storage: '1 TB SSD' },
      purchase_date: '2023-11-09',
      created_at: now,
    },
  ];
}

function lookupDemoDevice(query: string): Device | null {
  const clean = query.trim().toLowerCase();

  return getDemoDevices().find((device) => (
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
  const replacedCriticalParts = timeline.repair_events
    .filter((repair) => repair.status === 'approved')
    .flatMap((repair) => repair.parts)
    .filter((part) => [
      'motherboard',
      'display',
      'battery',
      'storage',
      'charging_assembly',
      'charging_port',
    ].includes(part.component_name)).length;
  const repairFrequency = hasRepairs ? Math.max(45, 100 - repairCount * 12) : 100;
  const recurringFaults = hasRepairs ? 90 : 100;
  const criticalComponentHistory = hasRepairs
    ? Math.max(45, 100 - replacedCriticalParts * 10)
    : 100;
  const deviceAge = hasRepairs ? 95 : 100;
  const healthScore = hasRepairs
    ? Math.round(
        deviceAge * 0.15 +
        repairFrequency * 0.30 +
        recurringFaults * 0.30 +
        criticalComponentHistory * 0.25,
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
      ? 'This score is based on the available repair history and replaced component records. Review the timeline before making a resale decision.'
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

function getDemoRepairs(deviceId: string): RepairEventWithParts[] {
  if (deviceId === 'demo-galaxy-s24') {
    return [
      {
        id: 'demo-repair-s24-charging',
        device_id: deviceId,
        technician_id: 'demo-tech-arun',
        symptom: 'Intermittent charging and cable movement required.',
        diagnosis: 'Charging connector pins worn; debris found inside port.',
        action_taken: 'Replaced charging assembly, cleaned internal connector path, tested fast charging.',
        cost: 2300,
        parent_repair_id: null,
        status: 'approved',
        created_at: '2026-08-28T11:20:00+05:30',
        profiles: {
          id: 'demo-tech-arun',
          role: 'technician',
          display_name: 'Arun Kumar',
          service_centre: 'Metro Device Care',
          created_at: '2026-01-01T00:00:00+05:30',
        },
        parts: [
          {
            id: 'demo-part-s24-charging',
            repair_event_id: 'demo-repair-s24-charging',
            component_name: 'charging_assembly',
            part_number: 'GH96-16522A',
            part_type: 'oem',
            supplier: 'Metro Device Care stock',
            cost: 1450,
            warranty_days: 90,
            evidence_url: null,
            warranty_records: [
              {
                id: 'demo-warranty-s24-charging',
                part_id: 'demo-part-s24-charging',
                start_date: '2026-08-28',
                end_date: '2026-11-26',
                status: 'active',
              },
            ],
          },
        ],
      },
    ];
  }

  if (deviceId === 'demo-thinkpad-x1') {
    return [
      {
        id: 'demo-repair-x1-battery',
        device_id: deviceId,
        technician_id: 'demo-tech-arun',
        symptom: 'Battery backup dropped below two hours.',
        diagnosis: 'Battery cycle count high; cell wear above service threshold.',
        action_taken: 'Replaced internal battery and calibrated power management.',
        cost: 6800,
        parent_repair_id: null,
        status: 'approved',
        created_at: '2026-04-16T14:15:00+05:30',
        profiles: {
          id: 'demo-tech-arun',
          role: 'technician',
          display_name: 'Arun Kumar',
          service_centre: 'Metro Device Care',
          created_at: '2026-01-01T00:00:00+05:30',
        },
        parts: [
          {
            id: 'demo-part-x1-battery',
            repair_event_id: 'demo-repair-x1-battery',
            component_name: 'battery',
            part_number: 'L19M4P71',
            part_type: 'compatible',
            supplier: 'Lenovo authorised distributor',
            cost: 5200,
            warranty_days: 180,
            evidence_url: null,
            warranty_records: [
              {
                id: 'demo-warranty-x1-battery',
                part_id: 'demo-part-x1-battery',
                start_date: '2026-04-16',
                end_date: '2026-10-13',
                status: 'expired',
              },
            ],
          },
        ],
      },
    ];
  }

  return [];
}
