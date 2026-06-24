import type { ExitCardComponentData } from '@/lib/chat/components';

interface ExitCardProps {
  data?: ExitCardComponentData;
}

export function ExitCard({ data }: ExitCardProps) {
  const options = Array.isArray(data?.options) ? data.options : [];

  return (
    <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
        Exit options
      </div>
      <h3 className="mt-3 font-serif text-2xl text-futurex-ink">
        {data?.title || 'Exit strategy'}
      </h3>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
            Projected asset value
          </div>
          <div className="mt-2 text-2xl font-semibold text-futurex-ink">
            {data?.projectedAssetValue || '—'}
          </div>
          <div className="mt-2 text-sm leading-6 text-futurex-muted">
            {data?.decisionProcess ||
              'Investor consent determines the exit path.'}
          </div>
        </div>
        <div className="rounded-2xl border border-futurex-gold-border bg-futurex-gold-soft/40 px-4 py-4 text-sm leading-6 text-futurex-ink">
          <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-gold">
            Governance note
          </div>
          <div className="mt-2">
            {data?.governanceNote ||
              'All material exit decisions require investor consent.'}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {options.length ? (
          options.map((option) => (
            <div
              key={option.label}
              className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4"
            >
              <div className="text-sm font-semibold text-futurex-ink">
                {option.label}
              </div>
              <p className="mt-2 text-sm leading-6 text-futurex-muted">
                {option.description || 'No description available.'}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4 text-sm text-futurex-muted sm:col-span-3">
            No exit options are available yet.
          </div>
        )}
      </div>
    </div>
  );
}
