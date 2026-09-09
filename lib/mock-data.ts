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
  id: 'owner_rhea',
  name: 'Rhea Nair',
  role: 'owner' as const,
  email: 'rhea.nair@example.com',
};

export const technicianProfile = {
  id: 'tech_arun',
  name: 'Arun Kumar',
  role: 'technician' as const,
  serviceCentre: 'Metro Device Care',
  email: 'arun@metrodevicecare.in',
};

const phoneBreakdown: HealthFactor[] = [
  { label: 'Device age', weight: 15, value: 12, direction: 'helped', note: 'Recent purchase date keeps age risk low.' },
  { label: 'Repair frequency', weight: 25, value: 17, direction: 'neutral', note: 'Two repairs recorded across normal use.' },
  { label: 'Recurring faults', weight: 25, value: 18, direction: 'hurt', note: 'Charging symptoms appeared more than once.' },
  { label: 'Critical components', weight: 20, value: 18, direction: 'helped', note: 'No motherboard or display replacement logged.' },
  { label: 'Warranty evidence', weight: 15, value: 17, direction: 'helped', note: 'Active warranty and repair evidence attached.' },
];

const laptopBreakdown: HealthFactor[] = [
  { label: 'Device age', weight: 15, value: 9, direction: 'hurt', note: 'Older working device with moderate age risk.' },
  { label: 'Repair frequency', weight: 25, value: 13, direction: 'hurt', note: 'Three service events recorded.' },
  { label: 'Recurring faults', weight: 25, value: 20, direction: 'helped', note: 'No repeated diagnosis pattern detected.' },
  { label: 'Critical components', weight: 20, value: 14, direction: 'neutral', note: 'Battery and cooling service, no board repair.' },
  { label: 'Warranty evidence', weight: 15, value: 12, direction: 'neutral', note: 'Battery warranty has expired.' },
];

export const mockDevices: Device[] = [
  {
    id: 'dev_s24_01',
    dnaId: 'DNA-S24-7K2M',
    ownerId: ownerProfile.id,
    type: 'phone',
    brand: 'Samsung',
    model: 'Galaxy S24',
    serialImei: '356938119028447',
    color: 'Onyx Black',
    specs: { storage: '256 GB', ram: '8 GB', network: '5G' },
    purchaseDate: '2025-04-18',
    registeredAt: '2025-04-22',
    healthScore: 82,
    previousScore: 78,
    status: 'Good',
    aiSummary: 'Well-maintained phone with one charging assembly repair and clear service evidence. A recurring charging symptom was resolved recently, and the replaced component is still under warranty.',
    scoreBreakdown: phoneBreakdown,
  },
  {
    id: 'dev_x1_01',
    dnaId: 'DNA-X1C-3Q8P',
    ownerId: ownerProfile.id,
    type: 'laptop',
    brand: 'Lenovo',
    model: 'ThinkPad X1 Carbon',
    serialImei: 'PF4Z9K21',
    specs: { processor: 'Intel Core i7', ram: '16 GB', storage: '1 TB SSD' },
    purchaseDate: '2023-11-09',
    registeredAt: '2024-01-14',
    healthScore: 68,
    previousScore: 72,
    status: 'Attention',
    aiSummary: 'Reliable business laptop with a recent battery replacement and older cooling service. Warranty coverage has expired, so future buyer review should focus on battery health and thermal performance.',
    scoreBreakdown: laptopBreakdown,
  },
];

export const mockRepairs: RepairEvent[] = [
  {
    id: 'rep_s24_charge',
    deviceId: 'dev_s24_01',
    technicianId: technicianProfile.id,
    technicianName: 'Arun Kumar',
    serviceCentre: 'Metro Device Care',
    explicitlyVerified: true,
    symptom: 'Intermittent charging and cable movement required.',
    diagnosis: 'Charging connector pins worn; debris found inside port.',
    actionTaken: 'Replaced charging assembly, cleaned internal connector path, tested fast charging.',
    serviceCost: 2300,
    repairWarrantyDays: 90,
    createdAt: '2026-08-28T11:20:00+05:30',
    recurringFault: true,
    locked: true,
    parts: [
      {
        id: 'part_s24_charge',
        component: 'charging assembly',
        partNumber: 'GH96-16522A',
        partType: 'OEM',
        supplier: 'Metro Device Care stock',
        cost: 1450,
        warrantyDays: 90,
        warrantyEnds: '2026-11-26',
        evidenceUrl: '/passport/dev_s24_01',
      },
    ],
  },
  {
    id: 'rep_s24_diag',
    deviceId: 'dev_s24_01',
    technicianId: 'tech_nisha',
    technicianName: 'Nisha Rao',
    serviceCentre: 'Northline Mobile Lab',
    explicitlyVerified: false,
    symptom: 'Slow charging after water exposure.',
    diagnosis: 'Moisture trace near charging port; no board damage detected.',
    actionTaken: 'Cleaned port and advised 24-hour drying period.',
    serviceCost: 600,
    repairWarrantyDays: 0,
    createdAt: '2026-07-12T16:45:00+05:30',
    locked: true,
    parts: [],
  },
  {
    id: 'rep_x1_battery',
    deviceId: 'dev_x1_01',
    technicianId: technicianProfile.id,
    technicianName: 'Arun Kumar',
    serviceCentre: 'Metro Device Care',
    explicitlyVerified: true,
    symptom: 'Battery backup dropped below two hours.',
    diagnosis: 'Battery cycle count high; cell wear above service threshold.',
    actionTaken: 'Replaced internal battery and calibrated power management.',
    serviceCost: 6800,
    repairWarrantyDays: 180,
    createdAt: '2026-04-16T14:15:00+05:30',
    locked: true,
    parts: [
      {
        id: 'part_x1_battery',
        component: 'battery',
        partNumber: 'L19M4P71',
        partType: 'compatible',
        supplier: 'Lenovo authorised distributor',
        cost: 5200,
        warrantyDays: 180,
        warrantyEnds: '2026-10-13',
        evidenceUrl: '/passport/dev_x1_01',
      },
    ],
  },
  {
    id: 'rep_x1_cooling',
    deviceId: 'dev_x1_01',
    technicianId: 'tech_iman',
    technicianName: 'Iman Sheikh',
    serviceCentre: 'Precision Laptop Works',
    explicitlyVerified: false,
    symptom: 'Fan noise during video calls.',
    diagnosis: 'Dust accumulation in cooling fins.',
    actionTaken: 'Cleaned cooling system and refreshed thermal compound.',
    serviceCost: 1500,
    repairWarrantyDays: 30,
    createdAt: '2025-12-03T10:35:00+05:30',
    locked: true,
    parts: [
      {
        id: 'part_x1_cooling',
        component: 'cooling',
        partNumber: 'THERMAL-SERVICE',
        partType: 'customer-provided',
        supplier: 'Service material',
        cost: 300,
        warrantyDays: 30,
        warrantyEnds: '2026-01-02',
      },
    ],
  },
  {
    id: 'rep_x1_keyboard_note',
    deviceId: 'dev_x1_01',
    technicianId: technicianProfile.id,
    technicianName: 'Arun Kumar',
    serviceCentre: 'Metro Device Care',
    explicitlyVerified: true,
    symptom: 'Correction to earlier keyboard inspection note.',
    diagnosis: 'Original note listed the keyboard as replaced; it was only reseated.',
    actionTaken: 'Added permanent correction entry. Original record remains visible.',
    serviceCost: 0,
    repairWarrantyDays: 0,
    createdAt: '2026-05-01T09:10:00+05:30',
    locked: true,
    parentRepairId: 'rep_x1_cooling',
    correctionNote: 'Keyboard was reseated, not replaced.',
    parts: [],
  },
];

export const mockDocuments: DocumentRecord[] = [
  { id: 'doc_s24_invoice', deviceId: 'dev_s24_01', docType: 'invoice', title: 'Purchase invoice', fileUrl: '#', uploadedAt: '2025-04-22', private: true },
  { id: 'doc_s24_evidence', deviceId: 'dev_s24_01', docType: 'evidence', title: 'Charging repair evidence', fileUrl: '#', uploadedAt: '2026-08-28', private: false },
  { id: 'doc_x1_invoice', deviceId: 'dev_x1_01', docType: 'invoice', title: 'ThinkPad invoice', fileUrl: '#', uploadedAt: '2024-01-14', private: true },
];

export const mockJobs: Job[] = [
  { id: 'job_091', deviceId: 'dev_s24_01', customerName: 'Rhea Nair', deviceName: 'Samsung Galaxy S24', category: 'Charging', status: 'Ready for pickup', value: 2300, time: '11:30 AM' },
  { id: 'job_092', deviceId: 'dev_x1_01', customerName: 'Karan Mehta', deviceName: 'Lenovo ThinkPad X1 Carbon', category: 'Battery', status: 'In diagnosis', value: 6800, time: '02:00 PM' },
  { id: 'job_093', deviceId: 'dev_s24_01', customerName: 'Asha Menon', deviceName: 'Samsung Galaxy S24', category: 'Warranty return', status: 'Warranty return', value: 0, time: '05:30 PM' },
];

export const mockActivities: Activity[] = [
  { id: 'act_1', role: 'owner', group: 'Today', title: 'Charging repair completed', detail: 'Galaxy S24 warranty active for 78 more days.', time: '11:20 AM', tone: 'success' },
  { id: 'act_2', role: 'owner', group: 'This week', title: 'Health score changed', detail: 'ThinkPad X1 Carbon moved from 72 to 68.', time: 'Tue, 05:10 PM', tone: 'warning' },
  { id: 'act_3', role: 'technician', group: 'Today', title: 'Permanent record created', detail: 'Metro Device Care logged a charging connector repair.', time: '11:20 AM', tone: 'success' },
  { id: 'act_4', role: 'technician', group: 'Earlier', title: 'Correction added', detail: 'Keyboard note corrected on ThinkPad X1 Carbon.', time: '01 May, 09:10 AM', tone: 'info' },
];

export const componentSets: Record<DeviceType, ComponentName[]> = {
  phone: ['battery', 'display', 'charging assembly', 'motherboard', 'camera', 'speaker', 'back panel'],
  laptop: ['battery', 'display', 'keyboard', 'storage', 'memory', 'motherboard', 'cooling', 'charging port'],
};
