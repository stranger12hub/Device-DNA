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
  market_value_estimate: number | null;
  market_value_summary: string | null;
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
  status: 'pending' | 'approved';
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

    const approvedTimeline: DeviceTimeline = {
      ...body.timeline,
      repair_events: body.timeline.repair_events.filter(
        (event) => event.status === 'approved',
      ),
    };
    const recurring = detectRecurringFault(approvedTimeline);
    const scoreResult = calculateHealthScore(
      approvedTimeline,
      recurring.recurringFault,
    );
    const previousScore = await getPreviousScore(approvedTimeline.id);
    const [aiSummary, marketValue] = await Promise.all([
      generateAiSummary(approvedTimeline, {
        ...recurring,
        warrantyStatus: [],
        health_score: scoreResult.health_score,
        score_breakdown: scoreResult.score_breakdown,
        previous_score: previousScore,
      }),
      generateMarketValue(approvedTimeline, scoreResult.health_score),
    ]);
    const response: InsightResponse = {
      ...recurring,
      warrantyStatus: [],
      health_score: scoreResult.health_score,
      score_breakdown: scoreResult.score_breakdown,
      ai_summary: aiSummary,
      previous_score: previousScore,
      market_value_estimate: marketValue.market_value_estimate,
      market_value_summary: marketValue.market_value_summary,
    };

    await writeDeviceScore(approvedTimeline.id, response);

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

    if (key) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }

  const recurring = [...buckets.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])[0];

  if (!recurring) {
    return { recurringFault: false };
  }

  return {
    recurringFault: true,
    recurringDetails: `${recurring[0]} appears across ${recurring[1]} approved repair records.`,
  };
}

function calculateHealthScore(
  timeline: DeviceTimeline,
  recurringFault: boolean,
): { health_score: number; score_breakdown: ScoreBreakdown } {
  if (timeline.repair_events.length === 0) {
    return {
      health_score: 100,
      score_breakdown: {
        deviceAge: 100,
        repairFrequency: 100,
        recurringFaults: 100,
        criticalComponentHistory: 100,
        warrantyEvidenceCompleteness: 100,
      },
    };
  }

  const deviceAge = scoreDeviceAge(timeline);
  const repairFrequency = scoreRepairFrequency(timeline);
  const recurringFaults = recurringFault ? 35 : 100;
  const criticalComponentHistory = scoreCriticalComponents(timeline);
  const score =
    deviceAge * 0.15 +
    repairFrequency * 0.35 +
    recurringFaults * 0.3 +
    criticalComponentHistory * 0.2;

  return {
    health_score: Math.max(0, Math.min(100, Math.round(score))),
    score_breakdown: {
      deviceAge,
      repairFrequency,
      recurringFaults,
      criticalComponentHistory,
      warrantyEvidenceCompleteness: 100,
    },
  };
}

async function generateAiSummary(
  timeline: DeviceTimeline,
  insight: Omit<
    InsightResponse,
    'ai_summary' | 'market_value_estimate' | 'market_value_summary'
  >,
): Promise<string | null> {
  const parsed = await callGemini([
    'Write a 2-3 sentence Device DNA device summary for a buyer.',
    'Explain the supplied deterministic health score. Do not change, invent, certify, or guarantee the score.',
    'Return only JSON: { "ai_summary": string }',
    JSON.stringify({ timeline, insight }),
  ].join('\n'));

  return typeof parsed?.ai_summary === 'string' ? parsed.ai_summary : null;
}

async function generateMarketValue(
  timeline: DeviceTimeline,
  healthScore: number,
): Promise<{
  market_value_estimate: number | null;
  market_value_summary: string | null;
}> {
  const parsed = await callGemini([
    'Estimate an Indian resale market value in INR for this device.',
    'Base it only on device age, brand/model, specs, health score, repair frequency, component history, part types, and evidence.',
    'If the data is too thin or confidence is low, return null for both fields. Do not guess.',
    'Return only JSON: { "market_value_estimate": number | null, "market_value_summary": string | null }',
    JSON.stringify({ timeline, healthScore }),
  ].join('\n'));

  const estimate =
    typeof parsed?.market_value_estimate === 'number'
      ? Math.round(parsed.market_value_estimate)
      : null;
  const summary =
    typeof parsed?.market_value_summary === 'string'
      ? parsed.market_value_summary
      : null;

  if (estimate === null || summary === null) {
    return {
      market_value_estimate: null,
      market_value_summary: null,
    };
  }

  return {
    market_value_estimate: estimate,
    market_value_summary: summary,
  };
}

async function callGemini(prompt: string): Promise<Record<string, unknown> | null> {
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
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    if (!response.ok) {
      console.error('Gemini error:', response.status, await response.text());
      return null;
    }

    const gemini = (await response.json()) as GeminiResponse;
    const text = gemini.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return null;
    }

    return JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    console.error('Gemini call failed:', error);
    return null;
  }
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
  const parts = timeline.repair_events.flatMap((event) => event.parts);
  const criticalCount = parts.filter((part) =>
    criticalComponents.has(part.component_name),
  ).length;
  const nonGenuineCount = parts.filter((part) =>
    ['compatible', 'refurbished', 'customer_provided'].includes(part.part_type),
  ).length;

  return Math.max(20, 100 - criticalCount * 14 - nonGenuineCount * 8);
}

async function getPreviousScore(deviceId: string): Promise<number | null> {
  const { data, error } = await getServiceClient()
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
  const { error } = await getServiceClient().from('device_scores').insert({
    device_id: deviceId,
    health_score: insight.health_score,
    score_breakdown: insight.score_breakdown,
    ai_summary: insight.ai_summary,
    previous_score: insight.previous_score,
    market_value_estimate: insight.market_value_estimate,
    market_value_summary: insight.market_value_summary,
  });

  if (error) {
    console.error('Device score write failed:', error);
  }
}

function getServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function fallbackInsight(): InsightResponse {
  return {
    recurringFault: false,
    warrantyStatus: [],
    health_score: 100,
    score_breakdown: {
      deviceAge: 100,
      repairFrequency: 100,
      recurringFaults: 100,
      criticalComponentHistory: 100,
      warrantyEvidenceCompleteness: 100,
    },
    ai_summary: null,
    previous_score: null,
    market_value_estimate: null,
    market_value_summary: null,
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
