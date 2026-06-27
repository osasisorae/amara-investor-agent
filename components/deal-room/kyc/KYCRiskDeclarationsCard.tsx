'use client';

import { useState } from 'react';
import type { KycRiskDeclarationsComponentData } from '@/lib/chat/components';
import {
  KYC_YES_NO_OPTIONS,
  type KycRiskDeclarationField,
  type KycYesNoValue,
} from '@/lib/kyc/requirements';

interface KYCRiskDeclarationsCardProps {
  leadId: string;
  data?: KycRiskDeclarationsComponentData;
  disabled?: boolean;
  onSendPrompt: (message: string) => Promise<void>;
}

export function KYCRiskDeclarationsCard({
  leadId,
  data,
  disabled = false,
  onSendPrompt,
}: KYCRiskDeclarationsCardProps) {
  const [values, setValues] = useState<
    Partial<Record<KycRiskDeclarationField, KycYesNoValue>>
  >({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectValue = (
    key: KycRiskDeclarationField,
    value: KycYesNoValue
  ) => {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
    setSubmitError('');
  };

  const submit = async () => {
    if (disabled || submitting) {
      return;
    }

    const missing = (data?.declarations || []).filter(
      (declaration) => !values[declaration.key]
    );

    if (missing.length > 0) {
      setSubmitError('Please answer every declaration before continuing.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const response = await fetch(`/api/kyc/${leadId}/risk-declarations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setSubmitError(payload.error || 'Failed to save risk declarations.');
        return;
      }

      await onSendPrompt('Risk declarations submitted');
    } catch (error) {
      console.error('Failed to save risk declarations:', error);
      setSubmitError('Failed to save risk declarations.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
        Risk declarations
      </div>
      <h3 className="mt-3 font-serif text-2xl text-futurex-ink">
        {data?.title || 'Confirm the risk declarations below'}
      </h3>

      <div className="mt-5 space-y-4">
        {(data?.declarations || []).map((declaration) => (
          <div
            key={declaration.key}
            className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4"
          >
            <div className="text-sm font-semibold text-futurex-ink">
              {declaration.label}
            </div>
            <div className="mt-2 text-sm leading-6 text-futurex-muted">
              {declaration.description}
            </div>
            <div className="mt-4 flex gap-2">
              {KYC_YES_NO_OPTIONS.map((option) => {
                const selected = values[declaration.key] === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => selectValue(declaration.key, option.value)}
                    disabled={disabled || submitting}
                    className={`rounded-full border px-4 py-2 text-sm transition disabled:opacity-50 ${
                      selected
                        ? 'border-futurex-gold bg-futurex-gold-soft/30 text-futurex-ink'
                        : 'border-futurex-line text-futurex-ink hover:border-futurex-gold hover:text-futurex-gold'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {submitError ? (
        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {submitError}
        </div>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={disabled || submitting}
        className="mt-5 rounded-full bg-futurex-gold px-5 py-3 text-sm font-semibold text-futurex-bg transition hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Saving...' : 'Save and continue'}
      </button>
    </div>
  );
}
