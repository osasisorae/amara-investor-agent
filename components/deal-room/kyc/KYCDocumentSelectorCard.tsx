'use client';

import { useState } from 'react';
import type { KycDocumentSelectorComponentData } from '@/lib/chat/components';
import type { KycPrimaryDocumentType } from '@/lib/kyc/config';

interface KYCDocumentSelectorCardProps {
  leadId: string;
  data?: KycDocumentSelectorComponentData;
  disabled?: boolean;
  onSendPrompt: (message: string) => Promise<void>;
}

export function KYCDocumentSelectorCard({
  leadId: _leadId,
  data,
  disabled = false,
  onSendPrompt,
}: KYCDocumentSelectorCardProps) {
  const [selected, setSelected] = useState<KycPrimaryDocumentType | null>(null);
  const [sending, setSending] = useState(false);
  const options = Array.isArray(data?.options) ? data.options : [];

  const selectDocument = async (
    value: KycPrimaryDocumentType,
    label: string
  ) => {
    if (disabled || sending) {
      return;
    }

    setSelected(value);
    setSending(true);

    try {
      await onSendPrompt(`I'll use my ${label}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
        Document type
      </div>
      <h3 className="mt-3 font-serif text-2xl text-futurex-ink">
        {data?.title || 'Choose your ID'}
      </h3>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {options.map((option) => {
          const isSelected = selected === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => selectDocument(option.value, option.label)}
              disabled={disabled || sending}
              className={`rounded-2xl border px-4 py-5 text-left transition disabled:opacity-50 ${
                isSelected
                  ? 'border-futurex-gold bg-futurex-gold-soft/30 text-futurex-ink'
                  : 'border-futurex-line bg-futurex-surface text-futurex-ink hover:border-futurex-gold'
              }`}
            >
              <div className="text-sm font-semibold">{option.label}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.14em] text-futurex-muted">
                {isSelected && sending ? 'Opening upload step...' : 'Select'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
