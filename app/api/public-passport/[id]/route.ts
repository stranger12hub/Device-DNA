import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database, DeviceTimeline } from '@/src/types/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('devices')
      .select(`
        *,
        repair_events (
          *,
          parts (
            *,
            warranty_records (*)
          ),
          profiles:technician_id (*)
        ),
        device_scores (*)
      `)
      .eq('id', id)
      .maybeSingle()
      .returns<DeviceTimeline | null>();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ ok: false, error: 'Device not found' }, { status: 404 });
    }

    const timeline: DeviceTimeline = {
      ...data,
      serial_imei: '',
      repair_events: (data.repair_events ?? [])
        .filter((repair) => repair.status === 'approved')
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()),
      device_scores: (data.device_scores ?? [])
        .sort((left, right) => new Date(right.generated_at).getTime() - new Date(left.generated_at).getTime()),
      documents: [],
      device_access: [],
    };

    return NextResponse.json({ ok: true, timeline }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
