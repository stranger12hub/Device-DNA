import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';
import type { Database } from '@/src/types/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AccessBody = {
  deviceId?: string;
  requesterName?: string;
  requesterPhone?: string;
  shopName?: string;
};

export async function GET(request: NextRequest) {
  try {
    const userId = await verifyClerkUser(request);

    if (!userId) {
      return json({ ok: false, error: 'Sign in again' }, 401);
    }

    const deviceId = request.nextUrl.searchParams.get('deviceId');
    const supabase = getServiceClient();

    if (deviceId) {
      const { data, error } = await supabase
        .from('repair_access_requests')
        .select('*, devices:device_id(*)')
        .eq('device_id', deviceId)
        .eq('requester_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        return json({ ok: false, error: error.message }, 500);
      }

      return json({ ok: true, requests: data ?? [] }, 200);
    }

    const { data: ownedDevices, error: deviceError } = await supabase
      .from('devices')
      .select('id')
      .eq('owner_id', userId);

    if (deviceError) {
      return json({ ok: false, error: deviceError.message }, 500);
    }

    const ownedDeviceIds = (ownedDevices ?? []).map((device) => device.id);
    const ownerQuery = ownedDeviceIds.length
      ? supabase
          .from('repair_access_requests')
          .select('*, devices:device_id(*)')
          .in('device_id', ownedDeviceIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null });

    const requesterQuery = supabase
      .from('repair_access_requests')
      .select('*, devices:device_id(*)')
      .eq('requester_id', userId)
      .order('created_at', { ascending: false });

    const [ownerResult, requesterResult] = await Promise.all([ownerQuery, requesterQuery]);
    const error = ownerResult.error ?? requesterResult.error;

    if (error) {
      return json({ ok: false, error: error.message }, 500);
    }

    const byId = new Map<string, unknown>();
    for (const item of [...(ownerResult.data ?? []), ...(requesterResult.data ?? [])]) {
      byId.set(item.id, item);
    }
    const ownerRequests = [...byId.values()].sort((a, b) => {
      const left = typeof a === 'object' && a && 'created_at' in a ? String(a.created_at) : '';
      const right = typeof b === 'object' && b && 'created_at' in b ? String(b.created_at) : '';
      return new Date(right).getTime() - new Date(left).getTime();
    });

    return json({ ok: true, requests: ownerRequests }, 200);
  } catch (error) {
    return json({ ok: false, error: getErrorMessage(error) }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyClerkUser(request);

    if (!userId) {
      return json({ ok: false, error: 'Sign in before requesting repair access' }, 401);
    }

    const body = (await request.json().catch(() => ({}))) as AccessBody;
    const validationError = validateBody(body);

    if (validationError) {
      return json({ ok: false, error: validationError }, 400);
    }

    const deviceId = body.deviceId!.trim();
    const supabase = getServiceClient();
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select()
      .eq('id', deviceId)
      .maybeSingle();

    if (deviceError) {
      return json({ ok: false, error: deviceError.message }, 500);
    }

    if (!device) {
      return json({ ok: false, error: 'Device not found' }, 404);
    }

    if (device.owner_id === userId) {
      return json({ ok: false, error: 'Owners cannot request repair access for their own device' }, 403);
    }

    await ensureTechnicianProfile(supabase, userId, body.requesterName);

    const { data, error } = await supabase
      .from('repair_access_requests')
      .insert({
        device_id: deviceId,
        requester_id: userId,
        requester_name: body.requesterName!.trim(),
        requester_phone: body.requesterPhone!.trim(),
        shop_name: body.shopName!.trim(),
      })
      .select('*, devices:device_id(*)')
      .single();

    if (error) {
      if (error.code === '23505') {
        return json({ ok: false, error: 'A pending or approved request already exists for this device' }, 409);
      }

      return json({ ok: false, error: error.message }, 500);
    }

    fetch(new URL('/api/request-approval', request.nextUrl.origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        requester_name: body.requesterName,
        requester_phone: body.requesterPhone,
        shop_name: body.shopName,
      }),
    }).catch(() => undefined);

    return json({ ok: true, request: data }, 200);
  } catch (error) {
    return json({ ok: false, error: getErrorMessage(error) }, 500);
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

function validateBody(body: AccessBody): string | null {
  if (!body.deviceId?.trim()) return 'Device ID is required';
  if (!body.requesterName?.trim()) return 'Name is required';
  if (!body.requesterPhone?.trim()) return 'Phone number is required';
  if (!body.shopName?.trim()) return 'Shop name is required';
  return null;
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

async function ensureTechnicianProfile(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  displayName?: string | null,
) {
  const { error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      role: 'technician',
      display_name: displayName?.trim() || null,
    });

  if (error && error.code !== '23505') {
    throw new Error(error.message);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status });
}
