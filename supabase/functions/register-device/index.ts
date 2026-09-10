import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
} from 'https://esm.sh/jose@5.9.6';

type DeviceType = 'phone' | 'laptop';

type RequestBody = {
  device_type?: DeviceType;
  brand?: string;
  model?: string;
  serial_imei?: string;
  specs?: Record<string, unknown>;
  purchase_date?: string | null;
  display_name?: string | null;
};

type JsonBody = {
  ok: boolean;
  device?: unknown;
  error?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const clerkUserId = await verifyClerkUser(request);

    if (!clerkUserId) {
      return json({ ok: false, error: 'Sign in again and retry registration' }, 401);
    }

    const body = await readJsonBody(request);
    const validationError = validateBody(body);

    if (validationError) {
      return json({ ok: false, error: validationError }, 400);
    }

    const supabase = getServiceClient();
    await ensureProfile(supabase, {
      id: clerkUserId,
      displayName: body.display_name,
    });

    const { data: device, error } = await supabase
      .from('devices')
      .insert({
        owner_id: clerkUserId,
        device_type: body.device_type,
        brand: body.brand?.trim(),
        model: body.model?.trim(),
        serial_imei: body.serial_imei?.trim(),
        specs: body.specs ?? {},
        purchase_date: body.purchase_date || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return json({ ok: false, error: 'A device with this serial or IMEI already exists' }, 409);
      }

      console.error('Device insert failed', error.code);
      return json({ ok: false, error: 'Could not register this device' }, 500);
    }

    return json({ ok: true, device }, 200);
  } catch (error) {
    console.error('register-device failed', error instanceof Error ? error.name : 'UnknownError');
    return json({ ok: false, error: 'Could not register this device' }, 500);
  }
});

async function verifyClerkUser(request: Request): Promise<string | null> {
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

async function readJsonBody(request: Request): Promise<RequestBody> {
  try {
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return {};
    }

    return body as RequestBody;
  } catch {
    return {};
  }
}

function validateBody(body: RequestBody): string | null {
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
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service configuration');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
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
    console.error('Profile insert failed', error.code);
    throw new Error('Profile insert failed');
  }
}

function json(body: JsonBody, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
