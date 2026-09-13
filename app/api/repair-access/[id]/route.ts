import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';
import { dnaTokens } from '@/lib/design-tokens';
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
      .select('*, devices:device_id(owner_id, brand, model)')
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

    if (body.decision === 'approved') {
      notifyTechnicianAccessApproved({
        technicianId: accessRequest.requester_id,
        technicianName: accessRequest.requester_name,
        shopName: accessRequest.shop_name,
        deviceName: device ? [device.brand, device.model].filter(Boolean).join(' ') : 'Device',
        addLogUrl: new URL(`/devices/${accessRequest.device_id}/repair`, request.nextUrl.origin).toString(),
      }).catch((error) => {
        console.error('Technician approval email failed', error instanceof Error ? error.message : 'Unknown error');
      });
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

async function notifyTechnicianAccessApproved({
  technicianId,
  technicianName,
  shopName,
  deviceName,
  addLogUrl,
}: {
  technicianId: string;
  technicianName: string;
  shopName: string;
  deviceName: string;
  addLogUrl: string;
}) {
  const to = await getClerkUserEmail(technicianId);

  if (!to) {
    throw new Error('Technician email could not be resolved');
  }

  const webhookUrl = process.env.N8N_APPROVAL_WEBHOOK_URL;
  const payload = {
    to,
    technicianName,
    shopName,
    deviceName,
    addLogUrl,
    type: 'technician_access_approved',
  };

  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) return;
    } catch {
      // Fall back to Gmail below.
    }
  }

  await sendGmailApprovalEmail(payload);
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

  if (!response.ok) return null;

  const user = (await response.json()) as {
    email_addresses?: { id?: string; email_address?: string }[];
    primary_email_address_id?: string;
  };

  return (
    user.email_addresses?.find((email) => email.id === user.primary_email_address_id)?.email_address ??
    user.email_addresses?.[0]?.email_address ??
    null
  );
}

async function sendGmailApprovalEmail({
  to,
  technicianName,
  shopName,
  deviceName,
  addLogUrl,
}: {
  to: string;
  technicianName: string;
  shopName: string;
  deviceName: string;
  addLogUrl: string;
}) {
  const gmailAddress = process.env.GMAIL_ADDRESS;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailAddress || !gmailAppPassword) {
    throw new Error('Missing Gmail SMTP env vars');
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
    subject: `Access approved for ${deviceName}`,
    text: [
      `Your technician access request was approved for ${deviceName}.`,
      `Shop: ${shopName}`,
      `Open this link to add the repair log: ${addLogUrl}`,
    ].join('\n'),
    html: buildApprovalEmailHtml({ technicianName, shopName, deviceName, addLogUrl }),
  });
}

function buildApprovalEmailHtml({
  technicianName,
  shopName,
  deviceName,
  addLogUrl,
}: {
  technicianName: string;
  shopName: string;
  deviceName: string;
  addLogUrl: string;
}) {
  const { colors } = dnaTokens;
  const wordmarkUrl = getPublicAssetUrl('/assets/icons/device-dna-wordmark-final.svg');

  return `
    <div style="margin:0;padding:28px;background:${colors.surface};font-family:Inter,Arial,sans-serif;color:${colors.textPrimary}">
      <div style="max-width:560px;margin:0 auto;border:1px solid ${colors.border};border-radius:20px;background:${colors.background};overflow:hidden">
        <div style="padding:28px">
          ${wordmarkUrl ? `<img src="${escapeHtml(wordmarkUrl)}" alt="device DNA" width="132" style="display:block;width:132px;height:auto;margin:0 0 22px" />` : '<p style="margin:0 0 18px;font-size:14px;font-weight:500;color:#1D1D1F">device DNA</p>'}
          <h1 style="margin:0;font-size:28px;line-height:1.18;font-weight:500;color:${colors.textPrimary}">Access approved</h1>
          <p style="margin:18px 0 0;font-size:16px;line-height:1.7;color:${colors.textSecondary}">
            ${escapeHtml(technicianName)} from ${escapeHtml(shopName)} can now add a repair log for
            <span style="font-weight:500;color:${colors.textPrimary}">${escapeHtml(deviceName)}</span>.
          </p>
          <a href="${escapeHtml(addLogUrl)}" style="display:inline-block;margin-top:24px;min-height:44px;line-height:44px;padding:0 18px;border-radius:999px;background:${colors.accent};color:${colors.background};text-decoration:none;font-weight:500">
            Add repair log
          </a>
          <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:${colors.textSecondary}">
            This link opens the exact approved device record in Device DNA.
          </p>
        </div>
      </div>
    </div>
  `;
}

function getPublicAssetUrl(path: string): string | null {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  return base ? new URL(path, base).toString() : null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status });
}
