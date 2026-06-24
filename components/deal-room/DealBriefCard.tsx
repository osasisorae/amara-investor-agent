import type { DealBriefCardComponentData } from '@/lib/chat/components';

interface DealBriefCardProps {
  data?: DealBriefCardComponentData;
}

export function DealBriefCard({ data }: DealBriefCardProps) {
  const snapshot = Array.isArray(data?.snapshot) ? data.snapshot : [];
  const revenueStreams = Array.isArray(data?.revenueStreams)
    ? data.revenueStreams
    : [];
  const capitalUse = Array.isArray(data?.capitalUse) ? data.capitalUse : [];

  return (
    <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
        Deal brief
      </div>
      <h3 className="mt-3 font-serif text-2xl text-futurex-ink">
        {data?.title || 'Deal brief'}
      </h3>

      <div className="mt-5 rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
          Snapshot
        </div>
        <div className="mt-4 divide-y divide-futurex-line">
          {snapshot.length ? (
            snapshot.map((item) => (
              <div
                key={item.label}
                className="flex items-start justify-between gap-4 py-3 text-sm"
              >
                <div className="text-futurex-muted">{item.label}</div>
                <div className="text-right font-medium text-futurex-ink">
                  {item.value}
                </div>
              </div>
            ))
          ) : (
            <div className="py-3 text-sm text-futurex-muted">
              Snapshot data is not available yet.
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
          What the SPV owns
        </div>
        <p className="mt-3 text-sm leading-6 text-futurex-ink">
          {data?.whatSpvOwns || 'Ownership detail is not available yet.'}
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-futurex-gold-border bg-futurex-gold-soft/40 p-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-gold">
          Returns summary
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-futurex-surface px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
              Original ticket
            </div>
            <div className="mt-2 text-2xl font-semibold text-futurex-ink">
              {data?.returnsSummary?.originalTicket || '—'}
            </div>
          </div>
          <div className="rounded-2xl bg-futurex-surface px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
              Base case total proceeds
            </div>
            <div className="mt-2 text-xl font-semibold text-futurex-ink">
              {data?.returnsSummary?.baseCaseTotalProceeds || '—'}
            </div>
            <div className="mt-2 text-sm text-futurex-gold">
              {data?.returnsSummary?.baseCaseMultiple || '—'}
            </div>
          </div>
          <div className="rounded-2xl bg-futurex-surface px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
              Upside total proceeds
            </div>
            <div className="mt-2 text-xl font-semibold text-futurex-ink">
              {data?.returnsSummary?.upsideCaseTotalProceeds || '—'}
            </div>
            <div className="mt-2 text-sm text-futurex-gold">
              {data?.returnsSummary?.upsideCaseMultiple || '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
          Revenue streams
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {revenueStreams.length ? (
            revenueStreams.map((stream) => (
              <div
                key={stream.label}
                className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4"
              >
                <div className="text-sm font-semibold text-futurex-ink">
                  {stream.label}
                </div>
                <div className="mt-2 text-xl font-semibold text-futurex-ink">
                  {stream.monthly}
                </div>
                {stream.note ? (
                  <div className="mt-2 text-xs leading-5 text-futurex-muted">
                    {stream.note}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4 text-sm text-futurex-muted sm:col-span-3">
              Revenue stream data is not available yet.
            </div>
          )}
        </div>
        <div className="mt-3 rounded-2xl border border-futurex-gold-border bg-futurex-gold-soft/40 px-4 py-4 text-sm text-futurex-ink">
          <span className="font-medium text-futurex-gold">Total gross:</span>{' '}
          {data?.totalGrossMonthly || '—'} / month
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
          Capital use
        </div>
        <div className="mt-4 space-y-3">
          {capitalUse.length ? (
            capitalUse.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-4 rounded-xl border border-futurex-line bg-futurex-surface2 px-4 py-3 text-sm"
              >
                <div className="text-futurex-ink">{item.label}</div>
                <div className="font-medium text-futurex-gold">
                  {item.amount}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-futurex-muted">
              Capital allocation data is not available yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
