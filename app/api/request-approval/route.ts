import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomInt } from 'node:crypto';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/src/types/database';

export const dynamic = 'force-dynamic';

type Body = {
  repair_event_id?: string;
};

type RepairLookup = {
  id: string;
  status: 'pending' | 'approved';
  profiles: {
    display_name: string | null;
  } | null;
  devices: {
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

const OTP_EXPIRY_MINUTES = 15;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;

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

    const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
    ).toISOString();

    const { error: insertError } = await supabase
      .from('approval_requests')
      .insert({
        repair_event_id: repair.id,
        otp_hash: hashOtp(repair.id, otp),
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error('Approval insert failed', insertError.code);
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
    console.error('request-approval API failed', error instanceof Error ? error.message : 'Unknown error');
    return json({ ok: false, error: 'Could not send approval request' }, 500);
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
        profiles:technician_id(display_name),
        devices:device_id(owner_id, brand, model)
      `,
    )
    .eq('id', repairEventId)
    .maybeSingle<RepairLookup>();

  if (error) {
    console.error('Repair lookup failed', error.code);
    throw new Error('Repair lookup failed');
  }

  return data;
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

async function getClerkUserEmail(userId: string): Promise<string | null> {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;

  if (!clerkSecretKey) {
    throw new Error('Missing CLERK_SECRET_KEY');
  }

  const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${clerkSecretKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    console.error('Clerk user lookup failed', response.status);
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

function hashOtp(repairEventId: string, otp: string): string {
  return createHash('sha256').update(`${repairEventId}:${otp}`).digest('hex');
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
  const from = process.env.GMAIL_ADDRESS;
  const password = process.env.GMAIL_APP_PASSWORD;

  if (!from || !password) {
    throw new Error('Missing Gmail SMTP configuration');
  }

  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: from,
      pass: password,
    },
  });

  await transport.sendMail({
    from,
    to,
    subject: 'Approve your Device DNA repair record',
    text: [
      `Your Device DNA approval code is ${otp}.`,
      `${technicianName} submitted a pending repair record for ${deviceName}.`,
      `This code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    ].join('\n'),
    html: renderEmail({ otp, technicianName, deviceName }),
  });
}

function renderEmail({
  otp,
  technicianName,
  deviceName,
}: {
  otp: string;
  technicianName: string;
  deviceName: string;
}) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#F6F8FC;color:#111827;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F8FC;margin:0;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;border-top:4px solid #2764FF;">
                <p style="margin:0 0 8px;color:#2764FF;font-size:13px;font-weight:700;text-transform:uppercase;">Device DNA</p>
                <h1 style="margin:0;color:#111827;font-size:24px;line-height:1.25;font-weight:700;">Approve repair record</h1>
                <p style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.6;">
                  ${escapeHtml(technicianName)} submitted a pending repair record for <strong>${escapeHtml(deviceName)}</strong>.
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

function json(body: { ok: boolean; error?: string }, status: number) {
  return NextResponse.json(body, { status });
}
