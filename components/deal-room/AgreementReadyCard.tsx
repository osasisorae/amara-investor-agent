'use client';

import type { AgreementReadyComponentData } from '@/lib/chat/components';

interface AgreementReadyCardProps {
  data?: AgreementReadyComponentData;
}

export function AgreementReadyCard({ data }: AgreementReadyCardProps) {
  const agreementUrl = data?.agreementUrl || '';
  const spvName = data?.spvName || 'the investment opportunity';

  return (
    <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-2xl text-emerald-300">
          ✓
        </div>
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
            Next step unlocked
          </div>
          <h3 className="mt-3 font-serif text-2xl text-futurex-ink">
            KYC Approved
          </h3>
          <p className="mt-2 text-sm leading-6 text-futurex-muted">
            You&apos;re cleared to review and sign your investment agreement for{' '}
            {spvName}.
          </p>
          <button
            type="button"
            onClick={() => {
              if (agreementUrl) {
                window.open(agreementUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            disabled={!agreementUrl}
            className="mt-5 rounded-full bg-futurex-gold px-5 py-3 text-sm font-semibold text-futurex-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Review and Sign Agreement →
          </button>
          <p className="mt-3 text-xs leading-5 text-futurex-muted">
            You&apos;ll sign electronically with OTP verification sent to your
            email.
          </p>
        </div>
      </div>
    </div>
  );
}
