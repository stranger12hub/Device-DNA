import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';
import type { Database } from '@/src/types/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PhoneBody = {
  phone?: string;
};

export async function PATCH(request: NextRequest) {
  try {
    const userId = await verifyClerkUser(request);

    if (!userId) {
      return json({ ok: false, error: 'Sign in again before saving phone number' }, 401);
    }

    const body = (await request.json().catch(() => ({}))) as PhoneBody;
    const phone = body.phone?.trim() ?? '';

    if (!phone) {
      return json({ ok: false, error: 'Phone number is required' }, 400);
    }

    const supabase = getServiceClient();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select()
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      return json({ ok: false, error: profileError.message }, 500);
    }

    if (!profile) {
      const { data: created, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          role: 'owner',
          phone,
        })
        .select()
        .single();

      if (createError) {
        return json({ ok: false, error: createError.message }, 500);
      }

      return json({ ok: true, profile: created }, 200);
    }

    if (profile.phone?.trim()) {
      return json({ ok: false, error: 'Phone number is already saved and cannot be changed' }, 409);
    }

    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ phone })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      return json({ ok: false, error: updateError.message }, 500);
    }

    return json({ ok: true, profile: updated }, 200);
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500,
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

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status });
}
