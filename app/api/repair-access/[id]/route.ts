import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';
import type { Database, RepairAccessStatus } from '@/src/types/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = {
  params: Promise<{ id: string }>;
};

type Body = {
  decision?: RepairAccessStatus;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const userId = await verifyClerkUser(request);

    if (!userId) {
      return json({ ok: false, error: 'Sign in again' }, 401);
    }

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Body;

    if (body.decision !== 'approved' && body.decision !== 'declined') {
      return json({ ok: false, error: 'Decision must be approved or declined' }, 400);
    }

    const supabase = getServiceClient();
    const { data: accessRequest, error: lookupError } = await supabase
      .from('repair_access_requests')
      .select('*, devices:device_id(owner_id)')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) {
      return json({ ok: false, error: lookupError.message }, 500);
    }

    const device = Array.isArray(accessRequest?.devices)
      ? accessRequest?.devices[0]
      : accessRequest?.devices;

    if (!accessRequest || device?.owner_id !== userId) {
      return json({ ok: false, error: 'Only the device owner can decide this request' }, 403);
    }

    if (accessRequest.status !== 'pending') {
      return json({ ok: false, error: 'This request has already been decided' }, 409);
    }

    const { error: updateError } = await supabase
      .from('repair_access_requests')
      .update({
        status: body.decision,
        decided_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return json({ ok: false, error: updateError.message }, 500);
    }

    return json({ ok: true }, 200);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500);
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

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status });
}
