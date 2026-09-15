import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';
import type { Database, DeviceTimeline } from '@/src/types/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const userId = await verifyClerkUser(request);

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Sign in again' }, { status: 401 });
    }

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
        device_scores (*),
        documents (*),
        device_access (*)
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

    const isOwner = data.owner_id === userId;
    const hasFamilyAccess = (data.device_access ?? []).some(
      (access) => access.user_id === userId,
    );
    const { data: approvedTechnicianAccess, error: accessError } = await supabase
      .from('repair_access_requests')
      .select('id')
      .eq('device_id', id)
      .eq('requester_id', userId)
      .eq('status', 'approved')
      .limit(1);

    if (accessError) {
      return NextResponse.json({ ok: false, error: accessError.message }, { status: 500 });
    }

    if (!isOwner && !hasFamilyAccess && !approvedTechnicianAccess?.length) {
      return NextResponse.json({ ok: false, error: 'Not allowed to view this device timeline' }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      timeline: {
        ...data,
        repair_events: (data.repair_events ?? []).sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()),
        device_scores: (data.device_scores ?? []).sort((left, right) => new Date(right.generated_at).getTime() - new Date(left.generated_at).getTime()),
      },
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

async function verifyClerkUser(request: NextRequest): Promise<string | null> {
  const authorization = request.headers.get('authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) return null;

  try {
    const unverified = decodeJwt(token);
    const issuer = typeof unverified.iss === 'string' ? unverified.iss : null;
    if (!issuer) return null;

    const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    const { payload } = await jwtVerify(token, jwks, { issuer });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
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
