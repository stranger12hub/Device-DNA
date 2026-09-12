export type Role = 'owner' | 'technician';
export type DeviceType = 'phone' | 'laptop';
export type HealthBand = 'Good' | 'Attention' | 'Critical';
export type WarrantyState = 'active' | 'expiring' | 'expired' | 'none';
export type PartType = 'OEM' | 'compatible' | 'refurbished' | 'customer-provided';
export type ComponentName =
  | 'battery'
  | 'display'
  | 'charging assembly'
  | 'motherboard'
  | 'camera'
  | 'speaker'
  | 'back panel'
  | 'keyboard'
  | 'storage'
  | 'memory'
  | 'cooling'
  | 'charging port';

export type DeviceSpec = Record<string, string>;

export type HealthFactor = {
  label: string;
  weight: number;
  value: number;
  direction: 'helped' | 'hurt' | 'neutral';
  note: string;
};

export type Device = {
  id: string;
  dnaId: string;
  ownerId: string;
  type: DeviceType;
  brand: string;
  model: string;
  serialImei: string;
  color?: string;
  specs: DeviceSpec;
  purchaseDate: string;
  registeredAt: string;
  healthScore: number;
  previousScore: number;
  status: HealthBand;
  aiSummary: string;
  scoreBreakdown: HealthFactor[];
};

export type Part = {
  id: string;
  component: ComponentName;
  partNumber: string;
  partType: PartType;
  supplier: string;
  cost: number;
  warrantyDays: number;
  warrantyEnds?: string;
  evidenceUrl?: string;
};

export type RepairEvent = {
  id: string;
  deviceId: string;
  technicianId: string;
  technicianName: string;
  serviceCentre: string;
  explicitlyVerified: boolean;
  symptom: string;
  diagnosis: string;
  actionTaken: string;
  serviceCost: number;
  repairWarrantyDays: number;
  createdAt: string;
  recurringFault?: boolean;
  locked: true;
  parentRepairId?: string;
  correctionNote?: string;
  parts: Part[];
};

export type DocumentRecord = {
  id: string;
  deviceId: string;
  docType: 'invoice' | 'warranty cert' | 'repair invoice' | 'evidence';
  title: string;
  fileUrl: string;
  uploadedAt: string;
  private: boolean;
};

export type Activity = {
  id: string;
  role: Role;
  group: 'Today' | 'This week' | 'Earlier';
  title: string;
  detail: string;
  time: string;
  tone: 'info' | 'success' | 'warning';
};

export type Job = {
  id: string;
  deviceId: string;
  customerName: string;
  deviceName: string;
  category: string;
  status: 'Scheduled' | 'In diagnosis' | 'Ready for pickup' | 'Warranty return';
  value: number;
  time: string;
};

export type WarrantyCardData = {
  id: string;
  deviceId: string;
  deviceName: string;
  component: string;
  state: WarrantyState;
  endsOn?: string;
  daysRemaining: number;
};

export const ownerProfile = {
  id: 'local-owner',
  name: 'Device owner',
  role: 'owner' as const,
  email: '',
};

export const technicianProfile = {
  id: 'local-technician',
  name: 'Technician',
  role: 'technician' as const,
  serviceCentre: '',
  email: '',
};

export const mockDevices: Device[] = [];
export const mockRepairs: RepairEvent[] = [];
export const mockDocuments: DocumentRecord[] = [];
export const mockJobs: Job[] = [];
export const mockActivities: Activity[] = [];

export const componentSets: Record<DeviceType, ComponentName[]> = {
  phone: ['battery', 'display', 'charging assembly', 'motherboard', 'camera', 'speaker', 'back panel'],
  laptop: ['battery', 'display', 'keyboard', 'storage', 'memory', 'motherboard', 'cooling', 'charging port'],
};
