import {
  Activity,
  Device,
  DeviceType,
  DocumentRecord,
  Job,
  Part,
  RepairEvent,
  Role,
  WarrantyCardData,
  ownerProfile,
} from './mock-data';

const STORAGE_KEY = 'device-dna-prototype-v2';

type Store = {
  devices: Device[];
  repairs: RepairEvent[];
  documents: DocumentRecord[];
  jobs: Job[];
  activities: Activity[];
};

export type RegisterDeviceInput = {
  type: DeviceType;
  brand: string;
  model: string;
  serialImei: string;
  color?: string;
  specs: Record<string, string>;
  purchaseDate: string;
};

export type RepairRecordInput = {
  deviceId: string;
  symptom: string;
  diagnosis: string;
  actionTaken: string;
  component: Part['component'];
  partNumber: string;
  partType: Part['partType'];
  supplier: string;
  partCost: number;
  warrantyDays: number;
  serviceCost: number;
  repairWarrantyDays: number;
  parentRepairId?: string;
  correctionNote?: string;
};

const seedStore = (): Store => ({
  devices: [],
  repairs: [],
  documents: [],
  jobs: [],
  activities: [],
});

function readStore(): Store {
  if (typeof window === 'undefined') return seedStore();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedStore();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    return JSON.parse(raw) as Store;
  } catch {
    const seeded = seedStore();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeStore(store: Store) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
}

function wait<T>(value: T, ms = 140): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), ms));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
}

export async function getDevices() {
  return wait(readStore().devices);
}

export async function getDevice(deviceId: string) {
  return wait(readStore().devices.find((device) => device.id === deviceId || device.dnaId.toLowerCase() === deviceId.toLowerCase()) ?? null);
}

export async function lookupDeviceByDnaId(query: string) {
  const clean = query.trim().toLowerCase();
  return wait(readStore().devices.find((device) => device.id.toLowerCase() === clean || device.dnaId.toLowerCase() === clean || device.serialImei.toLowerCase() === clean) ?? null);
}

export async function registerDevice(data: RegisterDeviceInput) {
  if (!data.brand.trim() || !data.model.trim() || !data.serialImei.trim()) {
    throw new Error('Brand, model, and serial/IMEI are required.');
  }
  const store = readStore();
  if (store.devices.some((device) => device.serialImei.toLowerCase() === data.serialImei.toLowerCase())) {
    throw new Error('A device with this serial or IMEI already exists.');
  }
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const device: Device = {
    id: `dev_${Date.now()}`,
    dnaId: `DNA-${suffix}-${data.type === 'phone' ? 'PH' : 'LP'}`,
    ownerId: ownerProfile.id,
    type: data.type,
    brand: data.brand.trim(),
    model: data.model.trim(),
    serialImei: data.serialImei.trim(),
    color: data.color,
    specs: data.specs,
    purchaseDate: data.purchaseDate,
    registeredAt: new Date().toISOString(),
    healthScore: 91,
    previousScore: 91,
    status: 'Good',
    aiSummary: 'Newly registered device with no repair events yet. Its history starts clean, and future repair records will remain permanent and transparent.',
    scoreBreakdown: [
      { label: 'Device age', weight: 15, value: 14, direction: 'helped', note: 'Recently registered.' },
      { label: 'Repair frequency', weight: 25, value: 25, direction: 'helped', note: 'No repairs logged.' },
      { label: 'Recurring faults', weight: 25, value: 25, direction: 'helped', note: 'No recurring faults.' },
      { label: 'Critical components', weight: 20, value: 20, direction: 'helped', note: 'No critical repairs.' },
      { label: 'Warranty evidence', weight: 15, value: 7, direction: 'neutral', note: 'Documents can improve confidence.' },
    ],
  };
  store.devices.unshift(device);
  store.activities.unshift({ id: `act_${Date.now()}`, role: 'owner', group: 'Today', title: 'Device registered', detail: `${device.brand} ${device.model} added to Device DNA.`, time: 'Just now', tone: 'success' });
  writeStore(store);
  return wait(device);
}

export async function getDeviceTimeline(deviceId: string) {
  const store = readStore();
  const device = store.devices.find((item) => item.id === deviceId || item.dnaId === deviceId);
  const repairs = store.repairs
    .filter((repair) => repair.deviceId === (device?.id ?? deviceId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return wait({ device: device ?? null, repairs });
}

export async function submitRepairRecord(data: RepairRecordInput) {
  if (!data.symptom.trim()) throw new Error('Symptoms are required.');
  const store = readStore();
  const repair: RepairEvent = {
    id: `rep_${Date.now()}`,
    deviceId: data.deviceId,
    technicianId: 'local-technician',
    technicianName: 'Technician',
    serviceCentre: '',
    explicitlyVerified: true,
    symptom: data.symptom,
    diagnosis: data.diagnosis,
    actionTaken: data.actionTaken,
    serviceCost: data.serviceCost,
    repairWarrantyDays: data.repairWarrantyDays,
    createdAt: new Date().toISOString(),
    locked: true,
    parentRepairId: data.parentRepairId,
    correctionNote: data.correctionNote,
    parts: data.partNumber || data.component
      ? [{
          id: `part_${Date.now()}`,
          component: data.component,
          partNumber: data.partNumber,
          partType: data.partType,
          supplier: data.supplier,
          cost: data.partCost,
          warrantyDays: data.warrantyDays,
          warrantyEnds: data.warrantyDays > 0 ? new Date(Date.now() + data.warrantyDays * 86400000).toISOString() : undefined,
        }]
      : [],
  };
  store.repairs.unshift(repair);
  store.activities.unshift({ id: `act_${Date.now()}`, role: 'technician', group: 'Today', title: data.parentRepairId ? 'Correction added' : 'Permanent record created', detail: repair.symptom, time: 'Just now', tone: 'success' });
  writeStore(store);
  return wait(repair);
}

export async function addCorrection(repairId: string, note: string) {
  const store = readStore();
  const parent = store.repairs.find((repair) => repair.id === repairId);
  if (!parent) throw new Error('Original repair record was not found.');
  return submitRepairRecord({
    deviceId: parent.deviceId,
    symptom: 'Correction entry',
    diagnosis: note,
    actionTaken: 'Added a separate permanent correction. Original record remains visible.',
    component: 'battery',
    partNumber: '',
    partType: 'customer-provided',
    supplier: '',
    partCost: 0,
    warrantyDays: 0,
    serviceCost: 0,
    repairWarrantyDays: 0,
    parentRepairId: repairId,
    correctionNote: note,
  });
}

export async function getDeviceScore(deviceId: string) {
  const device = await getDevice(deviceId);
  return wait(device ? { healthScore: device.healthScore, previousScore: device.previousScore, breakdown: device.scoreBreakdown, aiSummary: device.aiSummary } : null);
}

export async function recalculateDeviceScore(deviceId: string) {
  return getDeviceScore(deviceId);
}

export async function getDocuments(deviceId: string, publicOnly = false) {
  const docs = readStore().documents.filter((doc) => doc.deviceId === deviceId && (!publicOnly || !doc.private));
  return wait(docs);
}

export async function uploadDocument(deviceId: string, file: File, docType: DocumentRecord['docType']) {
  const store = readStore();
  const doc: DocumentRecord = {
    id: `doc_${Date.now()}`,
    deviceId,
    docType,
    title: file.name,
    fileUrl: '#',
    uploadedAt: new Date().toISOString(),
    private: docType !== 'evidence',
  };
  store.documents.unshift(doc);
  writeStore(store);
  return wait(doc);
}

export async function inviteFamilyMember(deviceId: string, userId: string) {
  return wait({ deviceId, userId, accessRole: 'family' as const });
}

export async function getActivities(role: Role) {
  return wait(readStore().activities.filter((activity) => activity.role === role));
}

export async function getJobs() {
  return wait(readStore().jobs);
}

export async function getJob(jobId: string) {
  return wait(readStore().jobs.find((job) => job.id === jobId) ?? null);
}

export async function getWarranties() {
  const store = readStore();
  const warranties: WarrantyCardData[] = store.repairs.flatMap((repair) => {
    const device = store.devices.find((item) => item.id === repair.deviceId);
    return repair.parts.map((part) => {
      const daysRemaining = part.warrantyEnds ? Math.ceil((new Date(part.warrantyEnds).getTime() - Date.now()) / 86400000) : 0;
      const state: WarrantyCardData['state'] = daysRemaining <= 0 ? 'expired' : daysRemaining <= 30 ? 'expiring' : 'active';
      return {
        id: `${repair.id}_${part.id}`,
        deviceId: repair.deviceId,
        deviceName: device ? `${device.brand} ${device.model}` : 'Unknown device',
        component: part.component,
        state,
        endsOn: part.warrantyEnds,
        daysRemaining,
      };
    });
  });
  return wait(warranties);
}
