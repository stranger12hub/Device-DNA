import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/src/types/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Body = {
  repair_event_id?: string;
  device_id?: string;
  requester_name?: string;
  requester_phone?: string;
  shop_name?: string;
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;

    const supabase = getServiceClient();
    const notification = body.repair_event_id
      ? await getRepairNotification(supabase, body.repair_event_id)
      : await getAccessRequestNotification(supabase, body);

    if (!notification) {
      return json({ ok: false, error: 'Notification target not found' }, 404);
    }

    if (!notification.ownerId) {
      return json({ ok: false, error: 'Device owner is not available' }, 400);
    }

    const ownerEmail = await getClerkUserEmail(notification.ownerId);

    if (!ownerEmail) {
      return json({ ok: false, error: 'Device owner email could not be resolved' }, 400);
    }

    await sendRepairNotification({
      to: ownerEmail,
      technicianName: notification.technicianName,
      deviceName: notification.deviceName,
      reason: notification.reason,
    });

    return json({ ok: true }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('request-approval API failed', message);
    return json({ ok: false, error: message }, 500);
  }
}

async function getRepairNotification(
  supabase: ReturnType<typeof getServiceClient>,
  repairEventId: string,
): Promise<{ ownerId: string | null; technicianName: string; deviceName: string; reason: string } | null> {
  const repair = await getRepairLookup(supabase, repairEventId);

  if (!repair?.devices) {
    return null;
  }

  return {
    ownerId: repair.devices.owner_id,
    technicianName: repair.profiles?.display_name?.trim() || 'Device DNA technician',
    deviceName: [repair.devices.brand, repair.devices.model].filter(Boolean).join(' ').trim() || 'your device',
    reason: 'submitted a new repair record',
  };
}

async function getAccessRequestNotification(
  supabase: ReturnType<typeof getServiceClient>,
  body: Body,
): Promise<{ ownerId: string | null; technicianName: string; deviceName: string; reason: string } | null> {
  if (!body.device_id || !body.requester_name || !body.requester_phone || !body.shop_name) {
    return null;
  }

  const { data: device, error } = await supabase
    .from('devices')
    .select('owner_id, brand, model')
    .eq('id', body.device_id)
    .maybeSingle();

  if (error || !device) {
    return null;
  }

  return {
    ownerId: device.owner_id,
    technicianName: `${body.requester_name.trim()} (${body.shop_name.trim()}, ${body.requester_phone.trim()})`,
    deviceName: [device.brand, device.model].filter(Boolean).join(' ').trim() || 'your device',
    reason: 'requested permission to add repair logs',
  };
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

async function sendRepairNotification({
  to,
  technicianName,
  deviceName,
  reason,
}: {
  to: string;
  technicianName: string;
  deviceName: string;
  reason: string;
}) {
  const webhookUrl = process.env.N8N_APPROVAL_WEBHOOK_URL;

  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          technicianName,
          deviceName,
          reason,
          type: 'repair_record_pending',
        }),
      });

      if (response.ok) {
        return;
      }

      console.error('n8n webhook failed, falling back to Gmail', response.status);
    } catch (error) {
      console.error('n8n webhook errored, falling back to Gmail', error);
    }
  }

  await sendGmailRepairNotification({ to, technicianName, deviceName, reason });
}

async function sendGmailRepairNotification({
  to,
  technicianName,
  deviceName,
  reason,
}: {
  to: string;
  technicianName: string;
  deviceName: string;
  reason: string;
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
    subject: `Device DNA update for ${deviceName}`,
    text: [
      `${technicianName} ${reason} for ${deviceName}.`,
      'Open Device DNA Activity to review it from your owner account.',
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
    html: `
      <div style="margin:0;padding:28px;background:#080B11;font-family:Inter,Arial,sans-serif;color:#F6F8FC">
        <div style="max-width:560px;margin:0 auto;border:1px solid #263247;border-radius:22px;background:#111722;overflow:hidden">
          <div style="height:3px;background:linear-gradient(90deg,#2764FF,#38BDF8)"></div>
          <div style="padding:28px">
            <p style="margin:0 0 18px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;font-weight:800;color:#38BDF8">Device DNA</p>
            <h1 style="margin:0;font-size:28px;line-height:1.1;font-weight:900;color:#ffffff">New device activity</h1>
            <p style="margin:18px 0 0;font-size:16px;line-height:1.7;color:#DCE3ED">
              <strong style="color:#ffffff">${escapeHtml(technicianName)}</strong> ${escapeHtml(reason)} for
              <strong style="color:#ffffff">${escapeHtml(deviceName)}</strong>.
            </p>
            <div style="margin:24px 0;padding:16px;border:1px solid #263247;border-radius:16px;background:#080B11">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#DCE3ED">
                Open Device DNA Activity from your owner account to review the request or see the latest record.
              </p>
            </div>
            <p style="margin:0;font-size:12px;line-height:1.6;color:#667085">
              Device DNA keeps repair history transparent and permanent. If this was not expected, you can ignore this email.
            </p>
          </div>
        </div>
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
