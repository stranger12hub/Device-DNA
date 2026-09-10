import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';
import type { Database, Json } from '@/src/types/database';

export const dynamic = 'force-dynamic';

type RegisterBody = {
  device_type?: 'phone' | 'laptop';
  brand?: string;
  model?: string;
  serial_imei?: string;
  specs?: Record<string, unknown>;
  purchase_date?: string | null;
  display_name?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyClerkUser(request);

    if (!userId) {
      return json({ ok: false, error: 'Sign in again and retry registration' }, 401);
    }

    const body = (await request.json().catch(() => ({}))) as RegisterBody;
    const validationError = validateBody(body);

    if (validationError) {
      return json({ ok: false, error: validationError }, 400);
    }
    const input = body as Required<
      Pick<RegisterBody, 'device_type' | 'brand' | 'model' | 'serial_imei'>
    > & RegisterBody;

    const supabase = getServiceClient();
    await ensureProfile(supabase, {
      id: userId,
      displayName: body.display_name,
    });

    const { data: device, error } = await supabase
      .from('devices')
      .insert({
        owner_id: userId,
        device_type: input.device_type,
        brand: input.brand.trim(),
        model: input.model.trim(),
        serial_imei: input.serial_imei.trim(),
        specs: (body.specs ?? {}) as Json,
        purchase_date: input.purchase_date || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return json({ ok: false, error: 'A device with this serial or IMEI already exists' }, 409);
      }

      console.error('Device insert failed', error.code, error.message);
      return json({ ok: false, error: `Device insert failed: ${error.message}` }, 500);
    }

    return json({ ok: true, device }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('register-device API failed', message);
    return json({ ok: false, error: message }, 500);
  }
}

async function verifyClerkUser(request: NextRequest): Promise<string | null> {
  const authorization = request.headers.get('authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return null;
  }

  try {
    const unverified = decodeJwt(token);
    const issuer = typeof unverified.iss === 'string' ? unverified.iss : null;

    if (!issuer) {
      return null;
    }

    const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    const { payload } = await jwtVerify(token, jwks, { issuer });

    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

function validateBody(body: RegisterBody): string | null {
  if (body.device_type !== 'phone' && body.device_type !== 'laptop') {
    return 'Device type is required';
  }

  if (!body.brand?.trim()) {
    return 'Brand is required';
  }

  if (!body.model?.trim()) {
    return 'Model is required';
  }

  if (!body.serial_imei?.trim()) {
    return 'Serial or IMEI is required';
  }

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

async function ensureProfile(
  supabase: ReturnType<typeof getServiceClient>,
  { id, displayName }: { id: string; displayName?: string | null },
) {
  const { error } = await supabase
    .from('profiles')
    .insert({
      id,
      role: 'owner',
      display_name: displayName?.trim() || null,
    });

  if (error && error.code !== '23505') {
    console.error('Profile insert failed', error.code, error.message);
    throw new Error(`Profile insert failed: ${error.message}`);
  }
}

function json(body: { ok: boolean; device?: unknown; error?: string }, status: number) {
  return NextResponse.json(body, { status });
}
