import type { OwnershipCardComponentData } from '@/lib/chat/components';

interface OwnershipCardProps {
  data?: OwnershipCardComponentData;
}

function parsePercent(value: string): number {
  const parsed = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function OwnershipCard({ data }: OwnershipCardProps) {
  const ticketShare = Math.min(parsePercent(data?.ticketShareOfRaise || '0'), 100);
  const holdings = Array.isArray(data?.legalHoldings) ? data.legalHoldings : [];

  return (
    <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
        Ownership
      </div>
      <h3 className="mt-3 font-serif text-2xl text-futurex-ink">
        {data?.title || 'Ownership'}
      </h3>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
            SPV stake
          </div>
          <div className="mt-2 text-2xl font-semibold text-futurex-ink">
            {data?.spvStakePercentage || '—'}
          </div>
          <div className="text-sm text-futurex-muted">
            per {data?.ticketAmount || 'ticket'}
          </div>
        </div>
        <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
            Total raise
          </div>
          <div className="mt-2 text-2xl font-semibold text-futurex-ink">
            {data?.totalRaise || '—'}
          </div>
          <div className="text-sm text-futurex-muted">
            {data?.investorSlots || '—'} investor slots
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-futurex-gold-border bg-futurex-gold-soft/40 p-4">
        <div className="flex items-center justify-between gap-3 text-sm text-futurex-ink">
          <span>Your share of the full raise</span>
          <span className="font-semibold text-futurex-gold">
            {data?.ticketShareOfRaise || '—'}
          </span>
        </div>
        <div className="mt-3 h-3 rounded-full bg-futurex-surface">
          <div
            className="h-3 rounded-full bg-futurex-gold"
            style={{ width: `${ticketShare}%` }}
          />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
          What the SPV legally holds
        </div>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-futurex-ink">
          {holdings.length ? (
            holdings.map((item) => <li key={item}>• {item}</li>)
          ) : (
            <li>• No holdings summary available yet.</li>
          )}
        </ul>
      </div>

      <div className="mt-4 rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4 text-sm leading-6 text-futurex-muted">
        <span className="font-medium text-futurex-ink">
          Distribution cadence:
        </span>{' '}
        {data?.quarterlyDistributionCadence ||
          'Quarterly distributions from operations.'}
      </div>
    </div>
  );
}
