import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomInt } from 'node:crypto';
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
      console.error('Approval insert failed', insertError.code, insertError.message);
      return json({ ok: false, error: `Could not create approval request: ${insertError.message}` }, 500);
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('request-approval API failed', message);
    return json({ ok: false, error: message }, 500);
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
    console.error('Repair lookup failed', error.code, error.message);
    throw new Error(`Repair lookup failed: ${error.message}`);
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
  const webhookUrl = process.env.N8N_APPROVAL_WEBHOOK_URL;

  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        otp,
        technicianName,
        deviceName,
      }),
    });

    if (!response.ok) {
      throw new Error(`n8n webhook failed with ${response.status}`);
    }

    return;
  }

  await sendGmailApprovalEmail({ to, otp, technicianName, deviceName });
}

async function sendGmailApprovalEmail({
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
  const gmailAddress = process.env.GMAIL_ADDRESS;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailAddress || !gmailAppPassword) {
    throw new Error('Missing N8N_APPROVAL_WEBHOOK_URL or Gmail SMTP env vars');
  }

  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailAddress,
      pass: gmailAppPassword,
    },
  });

  await transporter.sendMail({
    from: `"Device DNA" <${gmailAddress}>`,
    to,
    subject: `Approve repair record for ${deviceName}`,
    text: [
      `Your Device DNA approval code is ${otp}.`,
      '',
      `${technicianName} submitted a repair record for ${deviceName}.`,
      'This code expires in 15 minutes.',
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <p style="margin:0 0 12px">A repair record was submitted for <strong>${escapeHtml(deviceName)}</strong>.</p>
        <p style="margin:0 0 12px">Technician: <strong>${escapeHtml(technicianName)}</strong></p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:18px 0">${otp}</p>
        <p style="margin:0;color:#667085">This code expires in 15 minutes.</p>
      </div>
    `,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function json(body: { ok: boolean; error?: string }, status: number) {
  return NextResponse.json(body, { status });
}
