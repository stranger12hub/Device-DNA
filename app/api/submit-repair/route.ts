import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';
import type {
  ComponentName,
  Database,
  PartType,
  PartWithWarranty,
  WarrantyRecord,
} from '@/src/types/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RepairPartInput = {
  componentName: ComponentName;
  partNumber?: string | null;
  partType: PartType;
  supplier?: string | null;
  cost?: number | null;
  warrantyDays?: number;
  evidenceUrl?: string | null;
};

type SubmitRepairBody = {
  deviceId?: string;
  symptom?: string;
  diagnosis?: string | null;
  actionTaken?: string;
  cost?: number | null;
  parentRepairId?: string | null;
  parts?: RepairPartInput[];
  displayName?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyClerkUser(request);

    if (!userId) {
      return json({ ok: false, error: 'Sign in again and retry repair submission' }, 401);
    }

    const body = (await request.json().catch(() => ({}))) as SubmitRepairBody;
    const validationError = validateBody(body);

    if (validationError) {
      return json({ ok: false, error: validationError }, 400);
    }

    const input = body as Required<
      Pick<SubmitRepairBody, 'deviceId' | 'symptom' | 'actionTaken'>
    > & SubmitRepairBody;
    const supabase = getServiceClient();

    const { data: device, error: deviceError } = await retrySupabase(() => supabase
      .from('devices')
      .select('id, owner_id')
      .eq('id', input.deviceId)
      .maybeSingle());

    if (deviceError) {
      return json({ ok: false, error: `Device lookup failed: ${deviceError.message}` }, 500);
    }

    if (!device) {
      return json({ ok: false, error: 'Device not found' }, 404);
    }

    if (device.owner_id === userId) {
      return json({ ok: false, error: 'Device owners cannot add repair logs to their own device' }, 403);
    }

    const { data: approvedAccess, error: accessError } = await retrySupabase(() => supabase
      .from('repair_access_requests')
      .select('id')
      .eq('device_id', input.deviceId)
      .eq('requester_id', userId)
      .eq('status', 'approved')
      .limit(1));

    if (accessError) {
      return json({ ok: false, error: `Access check failed: ${accessError.message}` }, 500);
    }

    if (!approvedAccess?.length) {
      return json({ ok: false, error: 'Owner approval is required before adding repair logs' }, 403);
    }

    await ensureProfile(supabase, {
      id: userId,
      displayName: body.displayName,
    });

    const { data: repairEvent, error: repairError } = await retrySupabase(() => supabase
      .from('repair_events')
      .insert({
        device_id: input.deviceId,
        technician_id: userId,
        symptom: input.symptom.trim(),
        diagnosis: input.diagnosis?.trim() || null,
        action_taken: input.actionTaken.trim(),
        cost: input.cost ?? null,
        parent_repair_id: input.parentRepairId ?? null,
        status: 'approved',
      })
      .select()
      .single());

    if (repairError) {
      console.error('Repair insert failed', repairError.code, repairError.message);
      return json({ ok: false, error: `Repair insert failed: ${repairError.message}` }, 500);
    }

    const parts = body.parts?.length
      ? await insertParts(supabase, repairEvent.id, body.parts)
      : [];
    const warrantyRecords = parts.length
      ? await insertWarranties(supabase, parts)
      : [];

    fetch(new URL('/api/request-approval', request.nextUrl.origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repair_event_id: repairEvent.id }),
    }).catch((error) => {
      console.warn('Repair notification failed', error instanceof Error ? error.message : 'Unknown error');
    });

    return json({
      ok: true,
      repair: {
        ...repairEvent,
        parts: attachWarrantyRecords(parts, warrantyRecords),
      },
    }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('submit-repair API failed', message);
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

function validateBody(body: SubmitRepairBody): string | null {
  if (!body.deviceId) {
    return 'Device ID is required';
  }

  if (!body.symptom?.trim()) {
    return 'Symptoms are required';
  }

  if (!body.actionTaken?.trim()) {
    return 'Action taken is required';
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
      role: 'technician',
      display_name: displayName?.trim() || null,
    });

  if (error && error.code !== '23505') {
    console.error('Profile insert failed', error.code, error.message);
    throw new Error(`Profile insert failed: ${error.message}`);
  }
}

async function insertParts(
  supabase: ReturnType<typeof getServiceClient>,
  repairEventId: string,
  parts: RepairPartInput[],
) {
  const { data, error } = await supabase
    .from('parts')
    .insert(parts.map((part) => ({
      repair_event_id: repairEventId,
      component_name: part.componentName,
      part_number: part.partNumber ?? null,
      part_type: part.partType,
      supplier: part.supplier ?? null,
      cost: part.cost ?? null,
      warranty_days: part.warrantyDays ?? 0,
      evidence_url: part.evidenceUrl ?? null,
    })))
    .select();

  if (error) {
    console.error('Parts insert failed', error.code, error.message);
    throw new Error(`Parts insert failed: ${error.message}`);
  }

  return data;
}

async function insertWarranties(
  supabase: ReturnType<typeof getServiceClient>,
  parts: Awaited<ReturnType<typeof insertParts>>,
) {
  const today = new Date();
  const startDate = toDateOnly(today);
  const inserts = parts
    .filter((part) => part.warranty_days > 0)
    .map((part) => {
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + part.warranty_days);

      return {
        part_id: part.id,
        start_date: startDate,
        end_date: toDateOnly(endDate),
        status: 'active' as const,
      };
    });

  if (!inserts.length) {
    return [];
  }

  const { data, error } = await supabase
    .from('warranty_records')
    .insert(inserts)
    .select();

  if (error) {
    console.error('Warranty insert failed', error.code, error.message);
    throw new Error(`Warranty insert failed: ${error.message}`);
  }

  return data;
}

function attachWarrantyRecords(
  parts: Awaited<ReturnType<typeof insertParts>>,
  warrantyRecords: WarrantyRecord[],
): PartWithWarranty[] {
  return parts.map((part) => ({
    ...part,
    warranty_records: warrantyRecords.filter(
      (record) => record.part_id === part.id,
    ),
  }));
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function retrySupabase<T>(
  operation: () => PromiseLike<T>,
  attempts = 2,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const result = await operation();
      const maybeError = typeof result === 'object' && result && 'error' in result
        ? (result as { error?: { message?: string } | null }).error
        : null;

      if (!maybeError || attempt === attempts - 1 || !isTransientSupabaseError(maybeError.message)) {
        return result;
      }

      lastError = maybeError;
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
  }

  throw lastError;
}

function isTransientSupabaseError(message?: string) {
  const normalized = message?.toLowerCase() ?? '';
  return normalized.includes('gateway timeout') || normalized.includes('timeout') || normalized.includes('fetch failed');
}

function json(
  body: { ok: boolean; repair?: unknown; error?: string },
  status: number,
) {
  return NextResponse.json(body, { status });
}
