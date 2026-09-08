type WarrantyStatus = {
  partName: string;
  daysRemaining: number;
};

type InsightFlags = {
  recurringFault: boolean;
  recurringDetails?: string;
  warrantyStatus: WarrantyStatus[];
};

type WarrantyRecord = {
  start_date: string;
  end_date: string;
  status: string;
};

type PartWithWarranty = {
  part_name: string;
  warranty_days: number;
  warranty_records: WarrantyRecord[];
};

type RepairEventWithParts = {
  symptom: string;
  diagnosis: string | null;
  action_taken: string;
  logged_by: string | null;
  created_at: string;
  parts: PartWithWarranty[];
};

type DeviceTimeline = {
  id: string;
  serial_imei: string;
  device_type: 'phone';
  brand: string;
  model: string;
  created_at: string;
  repair_events: RepairEventWithParts[];
};

type GeminiPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: {
    content?: {
      parts?: GeminiPart[];
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

    const apiKey = Deno.env.get('GEMINI_API_KEY');

    if (!apiKey) {
      return jsonResponse(fallbackInsight(), 200);
    }

    const insight = await generateInsight(body.timeline, apiKey);
    return jsonResponse(insight, 200);
  } catch (error) {
    console.error('Insight function failed:', error);
    return jsonResponse(fallbackInsight(), 200);
  }
});

async function generateInsight(
  timeline: DeviceTimeline,
  apiKey: string,
): Promise<InsightFlags> {
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
                  text: buildPrompt(timeline),
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
      console.error('Gemini API error:', response.status, await response.text());
      return fallbackInsight(timeline);
    }

    const gemini = (await response.json()) as GeminiResponse;
    const text = gemini.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return fallbackInsight(timeline);
    }

    return normalizeInsight(JSON.parse(text), timeline);
  } catch (error) {
    console.error('Gemini insight generation failed:', error);
    return fallbackInsight(timeline);
  }
}

function buildPrompt(timeline: DeviceTimeline): string {
  return [
    'Analyze this device repair timeline for a hackathon MVP.',
    'Return only JSON matching this TypeScript shape:',
    '{ recurringFault: boolean, recurringDetails?: string, warrantyStatus: { partName: string, daysRemaining: number }[] }',
    'recurringFault should be true when symptoms, diagnoses, or actions show a repeated issue pattern.',
    'warrantyStatus should include every replaced part with active warranty days remaining based on warranty record end_date.',
    JSON.stringify(timeline),
  ].join('\n');
}

function normalizeInsight(value: unknown, timeline: DeviceTimeline): InsightFlags {
  if (!isObject(value)) {
    return fallbackInsight(timeline);
  }

  const recurringFault =
    typeof value.recurringFault === 'boolean' ? value.recurringFault : false;
  const warrantyStatus = Array.isArray(value.warrantyStatus)
    ? value.warrantyStatus.filter(isWarrantyStatus)
    : fallbackWarrantyStatus(timeline);

  return {
    recurringFault,
    ...(typeof value.recurringDetails === 'string'
      ? { recurringDetails: value.recurringDetails }
      : {}),
    warrantyStatus,
  };
}

function fallbackInsight(timeline?: DeviceTimeline): InsightFlags {
  return {
    recurringFault: false,
    warrantyStatus: timeline ? fallbackWarrantyStatus(timeline) : [],
  };
}

function fallbackWarrantyStatus(timeline: DeviceTimeline): WarrantyStatus[] {
  const today = new Date();

  return timeline.repair_events.flatMap((event) =>
    event.parts.flatMap((part) =>
      part.warranty_records
        .filter((record) => record.status === 'active')
        .map((record) => ({
          partName: part.part_name,
          daysRemaining: Math.max(
            0,
            Math.ceil(
              (new Date(record.end_date).getTime() - today.getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          ),
        })),
    ),
  );
}

function isWarrantyStatus(value: unknown): value is WarrantyStatus {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.partName === 'string' &&
    typeof value.daysRemaining === 'number' &&
    Number.isFinite(value.daysRemaining)
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function jsonResponse(body: InsightFlags, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
