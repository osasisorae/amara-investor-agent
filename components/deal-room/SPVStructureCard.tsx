'use client';

import type { SpvStructureCardComponentData } from '@/lib/chat/components';

interface SPVStructureCardProps {
  data?: SpvStructureCardComponentData;
  disabled?: boolean;
  onSendPrompt: (message: string) => Promise<void>;
}

export function SPVStructureCard({
  data,
  disabled = false,
  onSendPrompt,
}: SPVStructureCardProps) {
  const diligenceQuestions = Array.isArray(data?.diligenceQuestions)
    ? data.diligenceQuestions
    : [];

  return (
    <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
        SPV structure
      </div>
      <h3 className="mt-3 font-serif text-2xl text-futurex-ink">
        {data?.title || 'SPV structure explainer'}
      </h3>

      <div className="mt-5 rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
          Why an SPV
        </div>
        <p className="mt-3 text-sm leading-6 text-futurex-ink">
          {data?.whySpv || 'SPV structure detail is not available yet.'}
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-futurex-gold-border bg-futurex-gold-soft/30 p-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-gold">
          Ownership diagram
        </div>
        <div className="mt-4 grid gap-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
            <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4 text-center">
              <div className="text-sm font-semibold text-futurex-ink">
                {data?.investorGroupLabel || '76 investors'}
              </div>
            </div>
            <div className="text-center text-sm text-futurex-gold">
              subscribe into
            </div>
            <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4 text-center">
              <div className="text-sm font-semibold text-futurex-ink">
                {data?.spvLabel || 'SPV'}
              </div>
            </div>
            <div className="text-center text-sm text-futurex-gold">owns</div>
            <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4 text-center">
              <div className="text-sm font-semibold text-futurex-ink">
                {data?.assetSummary || 'Land + Hotel + Lounge + Infrastructure'}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
            <div className="md:col-start-3 rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4 text-center">
              <div className="text-sm font-semibold text-futurex-ink">
                {data?.spvLabel || 'SPV'}
              </div>
            </div>
            <div className="text-center text-sm text-futurex-gold">receives</div>
            <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4 text-center">
              <div className="text-sm font-semibold text-futurex-ink">
                {data?.revenueRecipientLabel || 'All project revenue'}
              </div>
            </div>
            <div className="text-center text-sm text-futurex-gold">split</div>
            <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4 text-center">
              <div className="text-sm font-semibold text-futurex-ink">
                {data?.revenueSplit?.investors || '70% investors'}
              </div>
              <div className="mt-1 text-xs text-futurex-muted">
                {data?.revenueSplit?.futurex || '30% FutureX'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
          What to ask in diligence
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {diligenceQuestions.length ? (
            diligenceQuestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => onSendPrompt(question)}
                disabled={disabled}
                className="rounded-full border border-futurex-line bg-futurex-surface px-4 py-2 text-left text-sm text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {question}
              </button>
            ))
          ) : (
            <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-3 text-sm text-futurex-muted">
              No diligence prompts are available yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
