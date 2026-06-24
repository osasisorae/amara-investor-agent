'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RevenueChartComponentData } from '@/lib/chat/components';

interface RevenueChartProps {
  data?: RevenueChartComponentData;
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat('en-NG', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatTooltipValue(value: unknown): string {
  if (typeof value === 'number') {
    return `₦${value.toLocaleString('en-NG')}`;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatTooltipValue(item)).join(', ');
  }

  return '—';
}

export function RevenueChart({ data }: RevenueChartProps) {
  const streams = Array.isArray(data?.streams) ? data.streams : [];

  if (!streams.length) {
    return (
      <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5 text-sm text-futurex-muted">
        Revenue model data is not available yet.
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
        Operating model
      </div>
      <h3 className="mt-3 font-serif text-2xl text-futurex-ink">
        {data?.title || 'Revenue model'}
      </h3>
      <p className="mt-3 text-sm leading-6 text-futurex-muted">
        {data?.description || 'Revenue data from the investment brief.'}
      </p>

      <div className="mt-5 h-72 rounded-2xl border border-futurex-line bg-futurex-surface p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={streams}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="#8a8078"
              tick={{ fill: '#8a8078', fontSize: 12 }}
            />
            <YAxis
              stroke="#8a8078"
              tick={{ fill: '#8a8078', fontSize: 12 }}
              tickFormatter={formatCompactCurrency}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#161412',
                borderColor: '#2a2520',
                borderRadius: '16px',
                color: '#f0ebe4',
              }}
              formatter={(value) => [formatTooltipValue(value), '']}
            />
            <Legend wrapperStyle={{ color: '#8a8078', fontSize: 12 }} />
            <Bar dataKey="monthly" name="Monthly" fill="#c9a66b" radius={[8, 8, 0, 0]} />
            <Bar dataKey="annual" name="Annual" fill="#6f5a37" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
            Gross revenue
          </div>
          <div className="mt-2 text-sm text-futurex-ink">
            {data?.grossRevenue?.monthly || '—'} / month
          </div>
          <div className="text-sm text-futurex-muted">
            {data?.grossRevenue?.annual || '—'} / year
          </div>
        </div>
        <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
            Operating costs
          </div>
          <div className="mt-2 text-sm text-futurex-ink">
            {data?.operatingCosts?.monthly || '—'} / month
          </div>
          <div className="text-sm text-futurex-muted">
            {data?.operatingCosts?.annual || '—'} / year
          </div>
        </div>
        <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
            Net profit
          </div>
          <div className="mt-2 text-sm text-futurex-ink">
            {data?.netProfit?.monthly || '—'} / month
          </div>
          <div className="text-sm text-futurex-muted">
            {data?.netProfit?.annual || '—'} / year
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-futurex-gold-border bg-futurex-gold-soft/40 p-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-gold">
          Net profit split
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-futurex-surface px-4 py-3">
            <div className="text-sm font-medium text-futurex-ink">
              Investors
            </div>
            <div className="mt-1 text-lg font-semibold text-futurex-gold">
              {data?.splitPercentages?.investors || '—'}
            </div>
            <div className="text-sm text-futurex-muted">
              {data?.splitValues?.investors || '—'} / year
            </div>
          </div>
          <div className="rounded-2xl bg-futurex-surface px-4 py-3">
            <div className="text-sm font-medium text-futurex-ink">
              FutureX
            </div>
            <div className="mt-1 text-lg font-semibold text-futurex-gold">
              {data?.splitPercentages?.futurex || '—'}
            </div>
            <div className="text-sm text-futurex-muted">
              {data?.splitValues?.futurex || '—'} / year
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
