'use client';

import { useState } from 'react';
import type { KycConsentComponentData } from '@/lib/chat/components';

interface KYCConsentCardProps {
  leadId: string;
  data?: KycConsentComponentData;
  disabled?: boolean;
  onSendPrompt: (message: string) => Promise<void>;
}

export function KYCConsentCard({
  leadId: _leadId,
  data,
  disabled = false,
  onSendPrompt,
}: KYCConsentCardProps) {
  const [sendingChoice, setSendingChoice] = useState<string | null>(null);
  const items = Array.isArray(data?.items) ? data.items : [];

  const sendChoice = async (message: string) => {
    if (disabled || sendingChoice) {
      return;
    }

    setSendingChoice(message);

    try {
      await onSendPrompt(message);
    } finally {
      setSendingChoice(null);
    }
  };

  return (
    <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
        KYC consent
      </div>
      <h3 className="mt-3 font-serif text-2xl text-futurex-ink">
        {data?.title || 'Before we proceed'}
      </h3>

      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4"
          >
            <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
              {item.label}
            </div>
            <p className="mt-2 text-sm leading-6 text-futurex-ink">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() =>
            sendChoice(data?.proceedLabel || 'I consent and want to proceed')
          }
          disabled={disabled || Boolean(sendingChoice)}
          className="rounded-full bg-futurex-gold px-4 py-3 text-sm font-semibold text-futurex-bg transition hover:opacity-90 disabled:opacity-50"
        >
          {sendingChoice === (data?.proceedLabel || 'I consent and want to proceed')
            ? 'Sending...'
            : data?.proceedLabel || 'I consent and want to proceed'}
        </button>
        <button
          type="button"
          onClick={() =>
            sendChoice(data?.questionsLabel || 'I have questions first')
          }
          disabled={disabled || Boolean(sendingChoice)}
          className="rounded-full border border-futurex-line px-4 py-3 text-sm text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold disabled:opacity-50"
        >
          {sendingChoice === (data?.questionsLabel || 'I have questions first')
            ? 'Sending...'
            : data?.questionsLabel || 'I have questions first'}
        </button>
      </div>
    </div>
  );
}
