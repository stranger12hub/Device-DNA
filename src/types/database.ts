export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DeviceType = 'phone';
export type WarrantyRecordStatus = 'active' | 'expired' | 'void';

export type Database = {
  public: {
    Tables: {
      devices: {
        Row: {
          id: string;
          serial_imei: string;
          device_type: DeviceType;
          brand: string;
          model: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          serial_imei: string;
          device_type?: DeviceType;
          brand: string;
          model: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      repair_events: {
        Row: {
          id: string;
          device_id: string;
          symptom: string;
          diagnosis: string | null;
          action_taken: string;
          logged_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          symptom: string;
          diagnosis?: string | null;
          action_taken: string;
          logged_by?: string | null;
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
        ];
      };
      parts: {
        Row: {
          id: string;
          repair_event_id: string;
          part_name: string;
          is_genuine: boolean;
          warranty_days: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          repair_event_id: string;
          part_name: string;
          is_genuine?: boolean;
          warranty_days?: number;
          created_at?: string;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          part_id: string;
          start_date: string;
          end_date: string;
          status?: WarrantyRecordStatus;
          created_at?: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Device = Database['public']['Tables']['devices']['Row'];
export type RepairEvent = Database['public']['Tables']['repair_events']['Row'];
export type Part = Database['public']['Tables']['parts']['Row'];
export type WarrantyRecord = Database['public']['Tables']['warranty_records']['Row'];

export type PartWithWarranty = Part & {
  warranty_records: WarrantyRecord[];
};

export type RepairEventWithParts = RepairEvent & {
  parts: PartWithWarranty[];
};

export type DeviceTimeline = Device & {
  repair_events: RepairEventWithParts[];
};
