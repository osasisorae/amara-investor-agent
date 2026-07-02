'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type {
  AgentEfficiencyMetric,
  AgentEfficiencySnapshot,
} from '@/lib/analytics/agent-efficiency';

interface AgentEfficiencyPanelProps {
  onUnauthorized: (response: Response) => boolean;
  refreshToken: number;
  headerActions?: ReactNode;
  embedded?: boolean;
}

const WINDOW_OPTIONS = [7, 30, 90] as const;

function formatTimestamp(value: number): string {
  return new Date(value * 1000).toLocaleString();
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

function formatMetricSupportingText(metric: AgentEfficiencyMetric): string | null {
  if (
    typeof metric.numerator === 'number' &&
    typeof metric.denominator === 'number'
  ) {
    return `${formatNumber(metric.numerator)} / ${formatNumber(metric.denominator)}`;
  }

  if (typeof metric.sampleSize === 'number') {
    return `${formatNumber(metric.sampleSize)} approved lead${
      metric.sampleSize === 1 ? '' : 's'
    }`;
  }

  return null;
}

function getMetricStatusClasses(status: AgentEfficiencyMetric['status']): string {
  switch (status) {
    case 'good':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100';
    case 'watch':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
    case 'bad':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
    case 'unavailable':
      return 'border-futurex-line bg-futurex-surface2 text-futurex-muted';
  }
}

function getScoreTextColor(score: number | null): string {
  if (score === null) {
    return 'text-futurex-muted';
  }

  if (score >= 80) {
    return 'text-emerald-300';
  }

  if (score >= 60) {
    return 'text-futurex-gold';
  }

  if (score >= 40) {
    return 'text-amber-200';
  }

  return 'text-rose-200';
}

export function AgentEfficiencyPanel({
  onUnauthorized,
  refreshToken,
  headerActions,
  embedded = false,
}: AgentEfficiencyPanelProps) {
  const [windowDays, setWindowDays] = useState<(typeof WINDOW_OPTIONS)[number]>(30);
  const [data, setData] = useState<AgentEfficiencySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/admin/metrics?windowDays=${windowDays}`, {
          cache: 'no-store',
        });

        if (onUnauthorized(response)) {
          return;
        }

        const payload = (await response.json()) as AgentEfficiencySnapshot & {
          error?: string;
        };

        if (!response.ok) {
          setError(payload.error || 'Failed to load efficiency metrics.');
          return;
        }

        setData(payload);
      } catch (loadError) {
        console.error('Failed to load agent efficiency metrics:', loadError);
        setError('Failed to load efficiency metrics.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [windowDays, refreshToken, onUnauthorized]);

  const activeSlaStages =
    data?.slaBreakdown.filter((stage) => stage.totalLeads > 0) || [];

  return (
    <section className="mb-8 rounded-lg border border-futurex-line bg-futurex-surface p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          {embedded ? (
            <>
              <div className="text-sm font-semibold text-futurex-ink">
                Efficiency scorecard
              </div>
              <p className="mt-1 max-w-2xl text-sm text-futurex-muted">
                Phase 1 scorecard based on engaged leads, current stage SLAs,
                and milestone progression already stored in the repo.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-serif text-futurex-ink">
                Amara Efficiency
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-futurex-muted">
                Phase 1 scorecard based on engaged leads, current stage SLAs,
                and milestone progression already stored in the repo.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {WINDOW_OPTIONS.map((option) => {
            const selected = option === windowDays;

            return (
              <button
                key={option}
                type="button"
                onClick={() => setWindowDays(option)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  selected
                    ? 'bg-futurex-gold text-futurex-bg'
                    : 'border border-futurex-line text-futurex-muted hover:border-futurex-gold hover:text-futurex-gold'
                }`}
              >
                Last {option} days
              </button>
            );
          })}

          {headerActions}
        </div>
      </div>

      {loading && !data ? (
        <div className="mt-6 rounded-2xl border border-futurex-line bg-futurex-surface2 px-4 py-4 text-sm text-futurex-muted">
          Loading efficiency scorecard...
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {data ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
            <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-futurex-muted">
                {data.score.label}
              </div>
              <div
                className={`mt-3 text-5xl font-semibold ${getScoreTextColor(
                  data.score.value
                )}`}
              >
                {data.score.value === null ? '—' : Math.round(data.score.value)}
              </div>
              <div className="mt-2 text-sm text-futurex-muted">
                {data.score.value === null
                  ? 'No engaged cohort yet in this window.'
                  : `Normalized across ${(data.score.availableWeight * 100).toFixed(
                      0
                    )}% of the target metric weight.`}
              </div>
              {data.score.note ? (
                <div className="mt-4 rounded-xl border border-futurex-gold-border bg-futurex-gold-soft px-3 py-3 text-sm text-futurex-gold">
                  {data.score.note}
                </div>
              ) : null}
              <div className="mt-4 text-xs text-futurex-muted">
                Updated {formatTimestamp(data.generatedAt)}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-futurex-muted">
                  Engaged leads
                </div>
                <div className="mt-2 text-3xl font-semibold text-futurex-ink">
                  {formatNumber(data.cohort.engagedLeadCount)}
                </div>
                <div className="mt-1 text-sm text-futurex-muted">
                  Leads that actually started the workflow in the selected window.
                </div>
              </div>

              <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-futurex-muted">
                  Active leads
                </div>
                <div className="mt-2 text-3xl font-semibold text-futurex-ink">
                  {formatNumber(data.cohort.activeLeadCount)}
                </div>
                <div className="mt-1 text-sm text-futurex-muted">
                  Cohort leads currently inside tracked SLA stages.
                </div>
              </div>

              <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-futurex-muted">
                  Funded leads
                </div>
                <div className="mt-2 text-3xl font-semibold text-futurex-ink">
                  {formatNumber(data.cohort.fundedLeadCount)}
                </div>
                <div className="mt-1 text-sm text-futurex-muted">
                  Engaged cohort leads that have reached payment confirmation.
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.components.map((metric) => {
              const supportingText = formatMetricSupportingText(metric);

              return (
                <div
                  key={metric.key}
                  className={`rounded-2xl border p-4 ${getMetricStatusClasses(
                    metric.status
                  )}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{metric.label}</div>
                      <div className="mt-1 text-xs opacity-80">
                        {metric.description}
                      </div>
                    </div>
                    <div className="rounded-full border border-current/20 px-2 py-1 text-[10px] uppercase tracking-[0.14em]">
                      {metric.status}
                    </div>
                  </div>

                  <div className="mt-5 text-3xl font-semibold">
                    {metric.formattedValue}
                  </div>

                  {supportingText ? (
                    <div className="mt-2 text-sm opacity-80">{supportingText}</div>
                  ) : null}

                  {metric.score !== null ? (
                    <div className="mt-2 text-xs opacity-75">
                      Score: {Math.round(metric.score)} / 100
                    </div>
                  ) : null}

                  <div className="mt-4 text-xs opacity-75">
                    Good {metric.benchmarks.good} • Watch {metric.benchmarks.watch}{' '}
                    • Bad {metric.benchmarks.bad}
                  </div>

                  {metric.note ? (
                    <div className="mt-3 rounded-xl border border-current/15 bg-black/10 px-3 py-2 text-xs opacity-90">
                      {metric.note}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-futurex-ink">
                  Current SLA pressure
                </div>
                <div className="text-sm text-futurex-muted">
                  Stage-by-stage view of active cohort leads and where they are
                  falling outside the configured timers.
                </div>
              </div>
              <div className="text-xs text-futurex-muted">
                Window start: {formatTimestamp(data.cohort.startAt)}
              </div>
            </div>

            {activeSlaStages.length === 0 ? (
              <div className="mt-4 rounded-xl border border-futurex-line bg-futurex-surface px-4 py-4 text-sm text-futurex-muted">
                No active cohort leads are currently in SLA-tracked stages.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {activeSlaStages.map((stage) => (
                  <div
                    key={stage.stage}
                    className="rounded-xl border border-futurex-line bg-futurex-surface px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-futurex-ink">
                          {stage.label}
                        </div>
                        <div className="mt-1 text-xs text-futurex-muted">
                          SLA target: {stage.slaHours}h
                        </div>
                      </div>

                      <div className="grid gap-3 text-sm sm:grid-cols-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.14em] text-futurex-muted">
                            Leads
                          </div>
                          <div className="mt-1 font-semibold text-futurex-ink">
                            {formatNumber(stage.totalLeads)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.14em] text-futurex-muted">
                            Within SLA
                          </div>
                          <div className="mt-1 font-semibold text-emerald-300">
                            {formatNumber(stage.withinSla)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.14em] text-futurex-muted">
                            Breached
                          </div>
                          <div
                            className={`mt-1 font-semibold ${
                              stage.breached > 0 ? 'text-rose-200' : 'text-futurex-ink'
                            }`}
                          >
                            {formatNumber(stage.breached)}
                            {stage.breachRate !== null
                              ? ` (${stage.breachRate.toFixed(0)}%)`
                              : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {data.notes.length > 0 ? (
            <div className="space-y-2">
              {data.notes.map((note) => (
                <div
                  key={note}
                  className="rounded-xl border border-futurex-gold-border bg-futurex-gold-soft px-4 py-3 text-sm text-futurex-gold"
                >
                  {note}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
