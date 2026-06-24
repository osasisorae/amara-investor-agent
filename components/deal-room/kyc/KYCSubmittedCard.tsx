import type { KycSubmittedComponentData } from '@/lib/chat/components';

const PIPELINE_STAGES = [
  { stage: 'outreach_sent', label: 'Outreach' },
  { stage: 'qualifying', label: 'Qualify' },
  { stage: 'deal_room', label: 'Deal Room' },
  { stage: 'kyc_intake', label: 'KYC Intake' },
  { stage: 'pending_human_review', label: 'Human Review' },
  { stage: 'agreement_pending', label: 'Agreement' },
  { stage: 'payment_pending', label: 'Payment' },
  { stage: 'closed', label: 'Closed' },
] as const;

interface KYCSubmittedCardProps {
  data?: KycSubmittedComponentData;
}

export function KYCSubmittedCard({ data }: KYCSubmittedCardProps) {
  const currentStage = 'pending_human_review';
  const currentIndex = PIPELINE_STAGES.findIndex(
    (stage) => stage.stage === currentStage
  );

  return (
    <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-2xl text-emerald-200">
        {'\u2713'}
      </div>
      <h3 className="mt-4 font-serif text-2xl text-futurex-ink">
        {data?.title || 'Documents submitted'}
      </h3>
      <p className="mt-3 text-sm leading-6 text-futurex-muted">
        {data?.description ||
          "A member of our compliance team will review your documents within 2 business days. You'll receive an email when your review is complete."}
      </p>

      <div className="mt-5 rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
          Current stage
        </div>
        <div className="mt-2 text-sm font-medium text-futurex-ink">
          Human review in progress
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PIPELINE_STAGES.map((stage, index) => {
          const isActive = index === currentIndex;
          const isComplete = index < currentIndex;

          return (
            <div
              key={stage.stage}
              className={`rounded-2xl border px-3 py-3 text-center text-xs ${
                isActive
                  ? 'border-futurex-gold bg-futurex-gold-soft text-futurex-gold'
                  : isComplete
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-futurex-line bg-futurex-surface text-futurex-muted'
              }`}
            >
              <div className="font-semibold">{index + 1}</div>
              <div className="mt-1 leading-4">{stage.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
