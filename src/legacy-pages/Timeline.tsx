// Mobile pass: 375px-safe timeline metadata, buttons, and insight banners.
import { useEffect, useState } from 'react';
import TimelineCard from '../components/TimelineCard';
import { getDeviceTimeline } from '../lib/services';
import { supabase } from '../lib/supabase';
import type { DeviceTimeline } from '../types/database';
import {
  getCurrentRoute,
  navigateToLogRepair,
  navigateToRegister,
} from '../lib/routes';
import LogRepair from './LogRepair';

type WarrantyStatus = {
  partName: string;
  daysRemaining: number;
};

type InsightFlags = {
  recurringFault: boolean;
  recurringDetails?: string;
  warrantyStatus: WarrantyStatus[];
  health_score: number;
  ai_summary: string;
};

type TimelineProps = {
  deviceId?: string;
};

export default function Timeline({ deviceId }: TimelineProps) {
  const route = getCurrentRoute();
  const selectedDeviceId =
    deviceId ?? (route.name === 'timeline' ? route.deviceId : '');
  const [timeline, setTimeline] = useState<DeviceTimeline | null>(null);
  const [insight, setInsight] = useState<InsightFlags | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const latestScore = timeline?.device_scores?.[0] ?? null;
  const visibleHealthScore = insight
    ? {
        health_score: insight.health_score,
        ai_summary: insight.ai_summary,
      }
    : latestScore;

  useEffect(() => {
    let isCurrent = true;

    async function fetchTimeline() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getDeviceTimeline(selectedDeviceId);

        if (isCurrent) {
          setTimeline(data);
        }
      } catch (fetchError) {
        if (isCurrent) {
          setError(getErrorMessage(fetchError));
          setTimeline(null);
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    if (selectedDeviceId) {
      void fetchTimeline();
    } else {
      setIsLoading(false);
      setTimeline(null);
    }

    return () => {
      isCurrent = false;
    };
  }, [selectedDeviceId, refreshKey]);

  useEffect(() => {
    let isCurrent = true;

    async function fetchInsight(currentTimeline: DeviceTimeline) {
      setIsAnalyzing(true);
      setInsight(null);

      try {
        const { data, error: insightError } =
          await supabase.functions.invoke<InsightFlags>('insight', {
            body: { timeline: currentTimeline },
          });

        if (insightError) {
          console.error('Insight function failed:', insightError);
          return;
        }

        if (isCurrent) {
          setInsight(data);
        }
      } catch (insightError) {
        console.error('Insight function failed:', insightError);
      } finally {
        if (isCurrent) {
          setIsAnalyzing(false);
        }
      }
    }

    if (timeline) {
      void fetchInsight(timeline);
    } else {
      setInsight(null);
      setIsAnalyzing(false);
    }

    return () => {
      isCurrent = false;
    };
  }, [timeline]);

  return (
    <main className="min-h-screen bg-[#FAFAFA] px-4 py-6 font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-[#171717] sm:px-8 lg:px-12">
      <section className="mx-auto grid w-full max-w-6xl gap-8">
        <header className="flex flex-col gap-6 border-b border-[#171717] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-[#171717]/60">
              RepairPass / Timeline
            </p>
            <h1 className="mt-3 max-w-3xl font-['PP_Neue_Montreal','Helvetica_Neue',Helvetica,Arial,sans-serif] text-4xl font-medium leading-none sm:text-6xl">
              Device history
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              className="min-h-11 border border-[#171717] px-3 text-left text-sm font-medium uppercase"
              type="button"
              onClick={navigateToRegister}
            >
              New device
            </button>
            <button
              className="min-h-11 border border-[#171717] px-3 text-left text-sm font-medium uppercase disabled:cursor-not-allowed disabled:border-[#171717]/25 disabled:text-[#171717]/40"
              type="button"
              onClick={() => navigateToLogRepair(selectedDeviceId)}
              disabled={!selectedDeviceId}
            >
              Log
            </button>
          </div>
        </header>

        {timeline ? (
          <section className="grid gap-2 border border-[#171717] p-4 sm:grid-cols-4 sm:p-5">
            <Meta label="Brand" value={timeline.brand || 'Unknown'} />
            <Meta label="Model" value={timeline.model || 'Unknown'} />
            <Meta label="Serial/IMEI" value={timeline.serial_imei} />
            <Meta label="Device ID" value={timeline.id} />
          </section>
        ) : null}

        {visibleHealthScore ? (
          <section className="grid gap-4 border border-[#171717] p-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:p-5">
            <div>
              <p className="text-xs font-medium uppercase text-[#171717]/45">
                Health score
              </p>
              <p className="mt-2 font-['PP_Neue_Montreal','Helvetica_Neue',Helvetica,Arial,sans-serif] text-5xl font-medium leading-none">
                {visibleHealthScore.health_score}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-[#171717]/45">
                AI summary
              </p>
              <p className="mt-2 text-sm leading-6 text-[#171717]/70">
                {visibleHealthScore.ai_summary}
              </p>
            </div>
          </section>
        ) : null}

        <LogRepair
          deviceId={selectedDeviceId}
          onRepairLogged={() => setRefreshKey((current) => current + 1)}
        />

        <InsightBanner insight={insight} isAnalyzing={isAnalyzing} />

        <section className="grid gap-4">
          {isLoading ? (
            <StatePanel message="Loading repair history..." />
          ) : error ? (
            <StatePanel tone="error" message={error} />
          ) : !timeline ? (
            <StatePanel message="Device not found." />
          ) : timeline.repair_events.length === 0 ? (
            <StatePanel message="No repairs logged yet — clean history" />
          ) : (
            <div className="relative grid gap-4 pl-5 before:absolute before:left-0 before:top-0 before:h-full before:w-px before:bg-[#171717]">
              {timeline.repair_events.map((event) => (
                <div className="relative" key={event.id}>
                  <span className="absolute -left-[25px] top-5 h-3 w-3 border border-[#171717] bg-[#FAFAFA]" />
                  <TimelineCard
                    event={event}
                    canApprove={false}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

type InsightBannerProps = {
  insight: InsightFlags | null;
  isAnalyzing: boolean;
};

function InsightBanner({ insight, isAnalyzing }: InsightBannerProps) {
  const activeWarranty =
    insight?.warrantyStatus.filter((part) => part.daysRemaining > 0) ?? [];
  const hasRecurringFault = insight?.recurringFault === true;
  const hasActiveWarranty = activeWarranty.length > 0;

  if (isAnalyzing) {
    return (
      <p className="border border-[#171717]/25 px-4 py-3 text-sm text-[#171717]/60">
        Analyzing history...
      </p>
    );
  }

  if (!hasRecurringFault && !hasActiveWarranty) {
    return null;
  }

  return (
    <section className="grid gap-3">
      {hasRecurringFault ? (
        <div className="border border-[#171717] bg-amber-100 p-4 text-sm leading-6">
          <p className="text-xs font-medium uppercase text-[#171717]/60">
            Recurring fault flagged
          </p>
          <p className="mt-2">
            {insight?.recurringDetails ||
              'Repeated repair pattern detected in this device history.'}
          </p>
        </div>
      ) : null}

      {hasActiveWarranty ? (
        <div className="border border-[#171717] bg-[#21F1A8] p-4 text-sm leading-6">
          <p className="text-xs font-medium uppercase text-[#171717]/60">
            Active warranty
          </p>
          <div className="mt-2 grid gap-1">
            {activeWarranty.map((part) => (
              <p key={`${part.partName}-${part.daysRemaining}`}>
                {part.partName}: {part.daysRemaining} days remaining
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

type MetaProps = {
  label: string;
  value: string;
};

function Meta({ label, value }: MetaProps) {
  return (
    <div className="grid gap-1 border-b border-[#171717] py-2 last:border-b-0 sm:border-b-0 sm:border-r sm:px-3 sm:last:border-r-0">
      <span className="text-xs font-medium uppercase text-[#171717]/45">
        {label}
      </span>
      <span className="min-w-0 break-all text-sm font-medium">{value}</span>
    </div>
  );
}

type StatePanelProps = {
  message: string;
  tone?: 'default' | 'error';
};

function StatePanel({ message, tone = 'default' }: StatePanelProps) {
  return (
    <div
      className={[
        'border p-6 text-sm leading-6',
        tone === 'error'
          ? 'border-red-700 text-red-700'
          : 'border-[#171717] text-[#171717]/60',
      ].join(' ')}
    >
      {message}
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'Could not load repair history.';
}
