import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

type RequestBody = {
  repair_event_id?: string;
};

type RepairLookup = {
  id: string;
  status: 'pending' | 'approved';
  technician_id: string | null;
  profiles: {
    display_name: string | null;
  } | null;
  devices: {
    id: string;
    owner_id: string | null;
    brand: string;
    model: string;
  } | null;
};

type ClerkUser = {
  email_addresses?: {
    email_address?: string;
    id?: string;
  }[];
  primary_email_address_id?: string;
};

type JsonBody = {
  ok: boolean;
  error?: string;
};

const OTP_EXPIRY_MINUTES = 15;

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
    const body = await readJsonBody(request);

    if (!body.repair_event_id) {
      return json({ ok: false, error: 'repair_event_id is required' }, 400);
    }

    const supabase = getServiceClient();
    const repair = await getRepairLookup(supabase, body.repair_event_id);

    if (!repair || !repair.devices) {
      return json({ ok: false, error: 'Repair event not found' }, 404);
    }

    if (repair.status !== 'pending') {
      return json({ ok: false, error: 'Repair event is not pending approval' }, 409);
    }

    if (!repair.devices.owner_id) {
      return json({ ok: false, error: 'Device owner is not available' }, 400);
    }

    const ownerEmail = await getClerkUserEmail(repair.devices.owner_id);

    if (!ownerEmail) {
      return json({ ok: false, error: 'Device owner email could not be resolved' }, 400);
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(repair.id, otp);
    const expiresAt = new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
    ).toISOString();

    const { error: insertError } = await supabase
      .from('approval_requests')
      .insert({
        repair_event_id: repair.id,
        otp_hash: otpHash,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error('Approval request insert failed');
      return json({ ok: false, error: 'Could not create approval request' }, 500);
    }

    await sendApprovalEmail({
      to: ownerEmail,
      otp,
      technicianName:
        repair.profiles?.display_name?.trim() || 'Device DNA technician',
      deviceName: [repair.devices.brand, repair.devices.model]
        .filter(Boolean)
        .join(' ')
        .trim() || 'your device',
    });

    return json({ ok: true }, 200);
  } catch (error) {
    console.error('request-approval failed', error instanceof Error ? error.name : 'UnknownError');
    return json({ ok: false, error: 'Could not send approval request' }, 500);
  }
});

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

async function getRepairLookup(
  supabase: ReturnType<typeof getServiceClient>,
  repairEventId: string,
): Promise<RepairLookup | null> {
  const { data, error } = await supabase
    .from('repair_events')
    .select(
      `
        id,
        status,
        technician_id,
        profiles:technician_id(display_name),
        devices:device_id(id, owner_id, brand, model)
      `,
    )
    .eq('id', repairEventId)
    .maybeSingle<RepairLookup>();

  if (error) {
    console.error('Repair event lookup failed');
    throw new Error('Repair event lookup failed');
  }

  return data;
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

async function getClerkUserEmail(userId: string): Promise<string | null> {
  const clerkSecretKey = Deno.env.get('CLERK_SECRET_KEY');

  if (!clerkSecretKey) {
    throw new Error('Missing Clerk service configuration');
  }

  const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${clerkSecretKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    console.error('Clerk user email lookup failed');
    return null;
  }

  const user = (await response.json()) as ClerkUser;

  return (
    user.email_addresses?.find(
      (email) => email.id === user.primary_email_address_id,
    )?.email_address ??
    user.email_addresses?.[0]?.email_address ??
    null
  );
}

function generateOtp(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const value = new DataView(bytes.buffer).getUint32(0) % 1_000_000;

  return value.toString().padStart(6, '0');
}

async function hashOtp(repairEventId: string, otp: string): Promise<string> {
  const input = new TextEncoder().encode(`${repairEventId}:${otp}`);
  const digest = await crypto.subtle.digest('SHA-256', input);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sendApprovalEmail({
  to,
  otp,
  technicianName,
  deviceName,
}: {
  to: string;
  otp: string;
  technicianName: string;
  deviceName: string;
}) {
  const from = Deno.env.get('GMAIL_ADDRESS');
  const password = Deno.env.get('GMAIL_APP_PASSWORD');

  if (!from || !password) {
    throw new Error('Missing SMTP configuration');
  }

  const client = new SMTPClient({
    connection: {
      hostname: 'smtp.gmail.com',
      port: 465,
      tls: true,
      auth: {
        username: from,
        password,
      },
    },
  });

  try {
    await client.send({
      from,
      to,
      subject: 'Approve your Device DNA repair record',
      content: [
        `Your Device DNA approval code is ${otp}.`,
        `${technicianName} submitted a pending repair record for ${deviceName}.`,
        `This code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
      ].join('\n'),
      html: renderApprovalEmail({
        otp,
        technicianName,
        deviceName,
      }),
    });
  } finally {
    await client.close();
  }
}

function renderApprovalEmail({
  otp,
  technicianName,
  deviceName,
}: {
  otp: string;
  technicianName: string;
  deviceName: string;
}): string {
  const safeTechnicianName = escapeHtml(technicianName);
  const safeDeviceName = escapeHtml(deviceName);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Device DNA Repair Approval</title>
  </head>
  <body style="margin:0;background:#F6F8FC;color:#111827;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F8FC;margin:0;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;border-top:4px solid #2764FF;">
                <p style="margin:0 0 8px;font-size:13px;letter-spacing:0;color:#2764FF;font-weight:700;text-transform:uppercase;">Device DNA</p>
                <h1 style="margin:0;color:#111827;font-size:24px;line-height:1.25;font-weight:700;">Approve repair record</h1>
                <p style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.6;">
                  ${safeTechnicianName} submitted a pending repair record for <strong style="color:#111827;">${safeDeviceName}</strong>.
                </p>
                <p style="margin:12px 0 0;color:#374151;font-size:15px;line-height:1.6;">
                  Use this one-time password to approve the record in Device DNA.
                </p>
                <div style="margin:24px 0;padding:20px;border:1px solid #dbe4ff;background:#F6F8FC;border-radius:8px;text-align:center;">
                  <p style="margin:0 0 8px;color:#4b5563;font-size:13px;font-weight:700;text-transform:uppercase;">Approval OTP</p>
                  <p style="margin:0;color:#2764FF;font-size:36px;line-height:1;font-weight:800;letter-spacing:8px;">${otp}</p>
                </div>
                <p style="margin:0;color:#111827;font-size:15px;line-height:1.6;font-weight:700;">
                  This OTP expires in ${OTP_EXPIRY_MINUTES} minutes.
                </p>
                <p style="margin:16px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
                  If you did not expect this request, ignore this email and do not share the OTP.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });
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
