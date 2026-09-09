// supabase/functions/insight/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type WarrantyStatus = {
  partName: string;
  daysRemaining: number;
};

type ScoreBreakdown = {
  deviceAge: number;
  repairFrequency: number;
  recurringFaults: number;
  criticalComponentHistory: number;
  warrantyEvidenceCompleteness: number;
};

type InsightResponse = {
  recurringFault: boolean;
  recurringDetails?: string;
  warrantyStatus: WarrantyStatus[];
  health_score: number;
  score_breakdown: ScoreBreakdown;
  ai_summary: string | null;
  previous_score: number | null;
};

type WarrantyRecord = {
  start_date: string;
  end_date: string;
  status: string;
};

type PartWithWarranty = {
  component_name: string;
  part_number: string | null;
  part_type: string;
  supplier: string | null;
  cost: number | null;
  warranty_days: number;
  evidence_url: string | null;
  warranty_records: WarrantyRecord[];
};

type RepairEventWithParts = {
  id: string;
  symptom: string;
  diagnosis: string | null;
  action_taken: string;
  cost: number | null;
  parent_repair_id: string | null;
  created_at: string;
  parts: PartWithWarranty[];
  profiles?: {
    display_name: string | null;
    service_centre: string | null;
  } | null;
};

type DeviceTimeline = {
  id: string;
  owner_id: string;
  serial_imei: string;
  device_type: 'phone' | 'laptop';
  brand: string;
  model: string;
  specs: unknown;
  purchase_date: string | null;
  created_at: string;
  repair_events: RepairEventWithParts[];
};

type GeminiResponse = {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
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
    return jsonResponse(fallbackInsight(), 405);
  }

  try {
    const body = (await request.json()) as { timeline?: DeviceTimeline };

    if (!body.timeline) {
      return jsonResponse(fallbackInsight(), 400);
    }

    const recurring = detectRecurringFault(body.timeline);
    const warrantyStatus = getWarrantyStatus(body.timeline);
    const scoreResult = calculateHealthScore(
      body.timeline,
      recurring.recurringFault,
      warrantyStatus,
    );
    const previousScore = await getPreviousScore(body.timeline.id);
    const aiSummary = await generateAiSummary(body.timeline, {
      ...recurring,
      warrantyStatus,
      health_score: scoreResult.health_score,
      score_breakdown: scoreResult.score_breakdown,
      previous_score: previousScore,
    });
    const response: InsightResponse = {
      ...recurring,
      warrantyStatus,
      health_score: scoreResult.health_score,
      score_breakdown: scoreResult.score_breakdown,
      ai_summary: aiSummary,
      previous_score: previousScore,
    };

    await writeDeviceScore(body.timeline.id, response);

    return jsonResponse(response, 200);
  } catch (error) {
    console.error('Insight function failed:', error);
    return jsonResponse(fallbackInsight(), 200);
  }
});

function detectRecurringFault(timeline: DeviceTimeline): {
  recurringFault: boolean;
  recurringDetails?: string;
} {
  const buckets = new Map<string, number>();

  for (const event of timeline.repair_events) {
    const key = normalizeFaultKey(
      [event.symptom, event.diagnosis, event.action_taken].join(' '),
    );

    if (!key) {
      continue;
    }

    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const recurring = [...buckets.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])[0];

  if (!recurring) {
    return { recurringFault: false };
  }

  return {
    recurringFault: true,
    recurringDetails: `${recurring[0]} appears across ${recurring[1]} repair records.`,
  };
}

function calculateHealthScore(
  timeline: DeviceTimeline,
  recurringFault: boolean,
  warrantyStatus: WarrantyStatus[],
): { health_score: number; score_breakdown: ScoreBreakdown } {
  const deviceAge = scoreDeviceAge(timeline);
  const repairFrequency = scoreRepairFrequency(timeline);
  const recurringFaults = recurringFault ? 35 : 100;
  const criticalComponentHistory = scoreCriticalComponents(timeline);
  const warrantyEvidenceCompleteness = scoreWarrantyEvidence(
    timeline,
    warrantyStatus,
  );
  const score =
    deviceAge * 0.15 +
    repairFrequency * 0.25 +
    recurringFaults * 0.25 +
    criticalComponentHistory * 0.2 +
    warrantyEvidenceCompleteness * 0.15;

  return {
    health_score: Math.max(0, Math.min(100, Math.round(score))),
    score_breakdown: {
      deviceAge,
      repairFrequency,
      recurringFaults,
      criticalComponentHistory,
      warrantyEvidenceCompleteness,
    },
  };
}

function scoreDeviceAge(timeline: DeviceTimeline): number {
  const anchor = timeline.purchase_date || timeline.created_at;
  const ageDays = daysBetween(new Date(anchor), new Date());

  if (ageDays <= 365) return 100;
  if (ageDays <= 730) return 85;
  if (ageDays <= 1095) return 70;
  if (ageDays <= 1460) return 55;
  return 40;
}

function scoreRepairFrequency(timeline: DeviceTimeline): number {
  const repairCount = timeline.repair_events.length;

  if (repairCount === 0) return 100;
  if (repairCount === 1) return 90;
  if (repairCount === 2) return 75;
  if (repairCount <= 4) return 55;
  return 30;
}

function scoreCriticalComponents(timeline: DeviceTimeline): number {
  const criticalComponents = new Set([
    'motherboard',
    'battery',
    'display',
    'storage',
    'memory',
    'cooling_system',
  ]);
  const criticalCount = timeline.repair_events.reduce(
    (count, event) =>
      count +
      event.parts.filter((part) => criticalComponents.has(part.component_name))
        .length,
    0,
  );
  const nonGenuineCount = timeline.repair_events.reduce(
    (count, event) =>
      count +
      event.parts.filter(
        (part) =>
          part.part_type === 'compatible' ||
          part.part_type === 'refurbished' ||
          part.part_type === 'customer_provided',
      ).length,
    0,
  );

  return Math.max(20, 100 - criticalCount * 14 - nonGenuineCount * 8);
}

function scoreWarrantyEvidence(
  timeline: DeviceTimeline,
  warrantyStatus: WarrantyStatus[],
): number {
  const parts = timeline.repair_events.flatMap((event) => event.parts);

  if (parts.length === 0) {
    return 100;
  }

  const withEvidence = parts.filter((part) => Boolean(part.evidence_url)).length;
  const withWarranty = warrantyStatus.length;
  const completeness = (withEvidence + withWarranty) / (parts.length * 2);

  return Math.round(completeness * 100);
}

function getWarrantyStatus(timeline: DeviceTimeline): WarrantyStatus[] {
  const today = new Date();

  return timeline.repair_events.flatMap((event) =>
    event.parts.flatMap((part) =>
      part.warranty_records
        .filter((record) => record.status === 'active')
        .map((record) => ({
          partName: part.component_name,
          daysRemaining: Math.max(
            0,
            Math.ceil(
              (new Date(record.end_date).getTime() - today.getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          ),
        }))
        .filter((record) => record.daysRemaining > 0),
    ),
  );
}

async function generateAiSummary(
  timeline: DeviceTimeline,
  insight: Omit<InsightResponse, 'ai_summary'>,
): Promise<string | null> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: [
                    'Write a 2-3 sentence RepairPass device summary for a buyer.',
                    'Explain the supplied deterministic health score. Do not change or invent the score.',
                    'Return only JSON: { "ai_summary": string }',
                    JSON.stringify({ timeline, insight }),
                  ].join('\n'),
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    if (!response.ok) {
      console.error('Gemini summary error:', response.status, await response.text());
      return null;
    }

    const gemini = (await response.json()) as GeminiResponse;
    const text = gemini.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return null;
    }

    const parsed = JSON.parse(text) as { ai_summary?: unknown };
    return typeof parsed.ai_summary === 'string' ? parsed.ai_summary : null;
  } catch (error) {
    console.error('Gemini summary failed:', error);
    return null;
  }
}

async function getPreviousScore(deviceId: string): Promise<number | null> {
  const supabase = getServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('device_scores')
    .select('health_score')
    .eq('device_id', deviceId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Previous score lookup failed:', error);
    return null;
  }

  return typeof data?.health_score === 'number' ? data.health_score : null;
}

async function writeDeviceScore(deviceId: string, insight: InsightResponse) {
  const supabase = getServiceClient();

  if (!supabase) {
    return;
  }

  const { error } = await supabase.from('device_scores').insert({
    device_id: deviceId,
    health_score: insight.health_score,
    score_breakdown: insight.score_breakdown,
    ai_summary: insight.ai_summary,
    previous_score: insight.previous_score,
  });

  if (error) {
    console.error('Device score write failed:', error);
  }
}

function getServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function fallbackInsight(): InsightResponse {
  return {
    recurringFault: false,
    warrantyStatus: [],
    health_score: 0,
    score_breakdown: {
      deviceAge: 0,
      repairFrequency: 0,
      recurringFaults: 0,
      criticalComponentHistory: 0,
      warrantyEvidenceCompleteness: 0,
    },
    ai_summary: null,
    previous_score: null,
  };
}

function normalizeFaultKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 3)
    .join(' ');
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(
    0,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function jsonResponse(body: InsightResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
