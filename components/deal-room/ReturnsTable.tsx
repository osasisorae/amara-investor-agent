import type { ReturnsTableComponentData } from '@/lib/chat/components';

interface ReturnsTableProps {
  data?: ReturnsTableComponentData;
}

export function ReturnsTable({ data }: ReturnsTableProps) {
  const rows = Array.isArray(data?.rows) ? data.rows : [];

  if (!rows.length) {
    return (
      <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5 text-sm text-futurex-muted">
        Return data is not available yet.
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
        Scenario analysis
      </div>
      <h3 className="mt-3 font-serif text-2xl text-futurex-ink">
        {data?.title || 'Return breakdown'}
      </h3>
      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-2 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.14em] text-futurex-muted">
              <th className="px-3 py-2 font-medium">Metric</th>
              <th className="px-3 py-2 font-medium">
                {data?.baseCaseLabel || 'Base case'}
              </th>
              <th className="px-3 py-2 font-medium">
                {data?.upsideCaseLabel || 'Upside case'}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className={
                  row.highlight
                    ? 'rounded-2xl bg-futurex-gold-soft text-futurex-ink'
                    : 'rounded-2xl bg-futurex-surface text-futurex-ink'
                }
              >
                <td className="rounded-l-2xl px-3 py-3 font-medium">
                  {row.label}
                </td>
                <td className="px-3 py-3">{row.baseCase || '—'}</td>
                <td className="rounded-r-2xl px-3 py-3">
                  {row.upsideCase || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
