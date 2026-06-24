import type { RiskTableComponentData } from '@/lib/chat/components';

interface RiskTableProps {
  data?: RiskTableComponentData;
}

export function RiskTable({ data }: RiskTableProps) {
  const rows = Array.isArray(data?.rows) ? data.rows : [];

  if (!rows.length) {
    return (
      <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5 text-sm text-futurex-muted">
        Risk data is not available yet.
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
        Risk register
      </div>
      <h3 className="mt-3 font-serif text-2xl text-futurex-ink">
        {data?.title || 'Risks and mitigations'}
      </h3>
      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-2 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.14em] text-futurex-muted">
              <th className="px-3 py-2 font-medium">Risk</th>
              <th className="px-3 py-2 font-medium">Mitigation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.risk} className="bg-futurex-surface text-futurex-ink">
                <td className="rounded-l-2xl px-3 py-3 align-top font-medium">
                  {row.risk || '—'}
                </td>
                <td className="rounded-r-2xl px-3 py-3 align-top text-futurex-muted">
                  {row.mitigation || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
