export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DeviceType = 'phone' | 'laptop';
export type ProfileRole = 'owner' | 'technician';
export type ComponentName =
  | 'battery'
  | 'display'
  | 'charging_assembly'
  | 'motherboard'
  | 'camera'
  | 'speaker'
  | 'back_panel'
  | 'keyboard'
  | 'storage'
  | 'memory'
  | 'cooling_system'
  | 'charging_port';
export type PartType = 'oem' | 'compatible' | 'refurbished' | 'customer_provided';
export type WarrantyRecordStatus = 'active' | 'expired' | 'void';
export type AccessRole = 'owner' | 'family';
export type DocumentType = 'invoice' | 'warranty_cert' | 'evidence';
export type RepairStatus = 'pending' | 'approved';
export type RepairAccessStatus = 'pending' | 'approved' | 'declined';

export type ScoreBreakdown = {
  deviceAge: number;
  repairFrequency: number;
  recurringFaults: number;
  criticalComponentHistory: number;
  warrantyEvidenceCompleteness: number;
};

export type Database = {
  public: {
    Tables: {
      devices: {
        Row: {
          id: string;
          owner_id: string;
          device_type: DeviceType;
          brand: string;
          model: string;
          serial_imei: string;
          specs: Json;
          purchase_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          device_type: DeviceType;
          brand: string;
          model: string;
          serial_imei: string;
          specs?: Json;
          purchase_date?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          role: ProfileRole;
          display_name: string | null;
          service_centre: string | null;
          phone: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          role: ProfileRole;
          display_name?: string | null;
          service_centre?: string | null;
          phone?: string | null;
          created_at?: string;
        };
        Update: {
          phone?: string | null;
        };
        Relationships: [];
      };
      repair_events: {
        Row: {
          id: string;
          device_id: string;
          technician_id: string;
          symptom: string;
          diagnosis: string | null;
          action_taken: string;
          cost: number | null;
          parent_repair_id: string | null;
          status: RepairStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          technician_id: string;
          symptom: string;
          diagnosis?: string | null;
          action_taken: string;
          cost?: number | null;
          parent_repair_id?: string | null;
          status?: RepairStatus;
          created_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'repair_events_device_id_fkey';
            columns: ['device_id'];
            referencedRelation: 'devices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'repair_events_technician_id_fkey';
            columns: ['technician_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'repair_events_parent_repair_id_fkey';
            columns: ['parent_repair_id'];
            referencedRelation: 'repair_events';
            referencedColumns: ['id'];
          },
        ];
      };
      parts: {
        Row: {
          id: string;
          repair_event_id: string;
          component_name: ComponentName;
          part_number: string | null;
          part_type: PartType;
          supplier: string | null;
          cost: number | null;
          warranty_days: number;
          evidence_url: string | null;
        };
        Insert: {
          id?: string;
          repair_event_id: string;
          component_name: ComponentName;
          part_number?: string | null;
          part_type: PartType;
          supplier?: string | null;
          cost?: number | null;
          warranty_days?: number;
          evidence_url?: string | null;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'parts_repair_event_id_fkey';
            columns: ['repair_event_id'];
            referencedRelation: 'repair_events';
            referencedColumns: ['id'];
          },
        ];
      };
      warranty_records: {
        Row: {
          id: string;
          part_id: string;
          start_date: string;
          end_date: string;
          status: WarrantyRecordStatus;
        };
        Insert: {
          id?: string;
          part_id: string;
          start_date: string;
          end_date: string;
          status?: WarrantyRecordStatus;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'warranty_records_part_id_fkey';
            columns: ['part_id'];
            referencedRelation: 'parts';
            referencedColumns: ['id'];
          },
        ];
      };
      device_scores: {
        Row: {
          id: string;
          device_id: string;
          health_score: number;
          score_breakdown: ScoreBreakdown;
          ai_summary: string | null;
          previous_score: number | null;
          market_value_estimate: number | null;
          market_value_summary: string | null;
          generated_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          health_score: number;
          score_breakdown: ScoreBreakdown;
          ai_summary?: string | null;
          previous_score?: number | null;
          market_value_estimate?: number | null;
          market_value_summary?: string | null;
          generated_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'device_scores_device_id_fkey';
            columns: ['device_id'];
            referencedRelation: 'devices';
            referencedColumns: ['id'];
          },
        ];
      };
      device_access: {
        Row: {
          id: string;
          device_id: string;
          user_id: string;
          access_role: AccessRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          user_id: string;
          access_role: AccessRole;
          created_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'device_access_device_id_fkey';
            columns: ['device_id'];
            referencedRelation: 'devices';
            referencedColumns: ['id'];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          device_id: string;
          uploaded_by: string | null;
          doc_type: DocumentType;
          file_url: string;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          uploaded_by?: string | null;
          doc_type: DocumentType;
          file_url: string;
          uploaded_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'documents_device_id_fkey';
            columns: ['device_id'];
            referencedRelation: 'devices';
            referencedColumns: ['id'];
          },
        ];
      };
      approval_requests: {
        Row: {
          id: string;
          repair_event_id: string;
          otp_hash: string;
          expires_at: string;
          verified: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          repair_event_id: string;
          otp_hash: string;
          expires_at: string;
          verified?: boolean;
          created_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'approval_requests_repair_event_id_fkey';
            columns: ['repair_event_id'];
            referencedRelation: 'repair_events';
            referencedColumns: ['id'];
          },
        ];
      };
      repair_access_requests: {
        Row: {
          id: string;
          device_id: string;
          requester_id: string;
          requester_name: string;
          requester_phone: string;
          shop_name: string;
          status: RepairAccessStatus;
          created_at: string;
          decided_at: string | null;
        };
        Insert: {
          id?: string;
          device_id: string;
          requester_id: string;
          requester_name: string;
          requester_phone: string;
          shop_name: string;
          status?: RepairAccessStatus;
          created_at?: string;
          decided_at?: string | null;
        };
        Update: {
          status?: RepairAccessStatus;
          decided_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'repair_access_requests_device_id_fkey';
            columns: ['device_id'];
            referencedRelation: 'devices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'repair_access_requests_requester_id_fkey';
            columns: ['requester_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      decide_repair_access_request: {
        Args: {
          request_id: string;
          decision: 'approved' | 'declined';
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Device = Database['public']['Tables']['devices']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type RepairEvent = Database['public']['Tables']['repair_events']['Row'];
export type Part = Database['public']['Tables']['parts']['Row'];
export type WarrantyRecord =
  Database['public']['Tables']['warranty_records']['Row'];
export type DeviceScore = Database['public']['Tables']['device_scores']['Row'];
export type DeviceAccess = Database['public']['Tables']['device_access']['Row'];
export type DocumentRecord = Database['public']['Tables']['documents']['Row'];
export type ApprovalRequest =
  Database['public']['Tables']['approval_requests']['Row'];
export type RepairAccessRequest =
  Database['public']['Tables']['repair_access_requests']['Row'];

export type PartWithWarranty = Part & {
  warranty_records: WarrantyRecord[];
};

export type RepairEventWithParts = RepairEvent & {
  parts: PartWithWarranty[];
  profiles?: Profile | null;
};

export type DeviceTimeline = Device & {
  repair_events: RepairEventWithParts[];
  device_scores: DeviceScore[];
  documents?: DocumentRecord[];
  device_access?: DeviceAccess[];
};
