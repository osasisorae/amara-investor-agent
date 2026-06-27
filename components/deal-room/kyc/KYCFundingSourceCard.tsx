'use client';

import { useState } from 'react';
import type { KycFundingSourceComponentData } from '@/lib/chat/components';
import {
  isKycSourceOfFundsType,
  type KycSourceOfFundsType,
} from '@/lib/kyc/requirements';

interface FundingSourceState {
  source_of_funds_type: KycSourceOfFundsType | '';
  source_of_funds_summary: string;
  source_of_wealth_summary: string;
}

interface KYCFundingSourceCardProps {
  leadId: string;
  data?: KycFundingSourceComponentData;
  disabled?: boolean;
  onSendPrompt: (message: string) => Promise<void>;
}

export function KYCFundingSourceCard({
  leadId,
  data,
  disabled = false,
  onSendPrompt,
}: KYCFundingSourceCardProps) {
  const [values, setValues] = useState<FundingSourceState>({
    source_of_funds_type: data?.sourceOfFundsType || '',
    source_of_funds_summary: data?.sourceOfFundsSummary || '',
    source_of_wealth_summary: data?.sourceOfWealthSummary || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const setField = (field: keyof FundingSourceState, value: string) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
    setErrors((current) => ({
      ...current,
      [field]: '',
    }));
    setSubmitError('');
  };

  const submit = async () => {
    if (disabled || submitting) {
      return;
    }

    const nextErrors: Record<string, string> = {};

    if (!values.source_of_funds_type) {
      nextErrors.source_of_funds_type = 'Select a funding source';
    }

    if (!values.source_of_funds_summary.trim()) {
      nextErrors.source_of_funds_summary =
        'Explain how the money for this investment was generated';
    }

    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const response = await fetch(`/api/kyc/${leadId}/funding-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setSubmitError(payload.error || 'Failed to save source of funds.');
        return;
      }

      await onSendPrompt('Funding source submitted');
    } catch (error) {
      console.error('Failed to save source of funds:', error);
      setSubmitError('Failed to save source of funds.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
        Source of funds
      </div>
      <h3 className="mt-3 font-serif text-2xl text-futurex-ink">
        {data?.title || 'How will you fund this investment'}
      </h3>
      <p className="mt-2 text-sm leading-6 text-futurex-muted">
        Tell FutureX exactly where the money for this investment comes from. Extra background on your broader wealth helps review, but it should not stop you from submitting.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {(data?.options || []).map((option) => {
          const isSelected = values.source_of_funds_type === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                isKycSourceOfFundsType(option.value) &&
                setField('source_of_funds_type', option.value)
              }
              disabled={disabled || submitting}
              className={`rounded-2xl border px-4 py-4 text-left transition disabled:opacity-50 ${
                isSelected
                  ? 'border-futurex-gold bg-futurex-gold-soft/30 text-futurex-ink'
                  : 'border-futurex-line bg-futurex-surface text-futurex-ink hover:border-futurex-gold'
              }`}
            >
              <div className="text-sm font-semibold">{option.label}</div>
            </button>
          );
        })}
      </div>
      {errors.source_of_funds_type ? (
        <div className="mt-2 text-xs text-rose-300">
          {errors.source_of_funds_type}
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <label className="mb-2 block text-sm text-futurex-muted">
            Explain how this specific FutureX investment will be funded
          </label>
          <textarea
            value={values.source_of_funds_summary}
            onChange={(event) =>
              setField('source_of_funds_summary', event.target.value)
            }
            disabled={disabled || submitting}
            rows={4}
            className={`w-full rounded-2xl border bg-futurex-surface px-4 py-3 text-futurex-ink outline-none transition placeholder:text-futurex-muted disabled:opacity-50 ${
              errors.source_of_funds_summary
                ? 'border-rose-500'
                : 'border-futurex-line focus:border-futurex-gold'
            }`}
            placeholder="Example: The funds come from salary savings accumulated over the last 18 months and will be sent from my Barclays account in my name."
          />
          {errors.source_of_funds_summary ? (
            <div className="mt-2 text-xs text-rose-300">
              {errors.source_of_funds_summary}
            </div>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm text-futurex-muted">
            Briefly describe how your broader wealth was built (optional)
          </label>
          <textarea
            value={values.source_of_wealth_summary}
            onChange={(event) =>
              setField('source_of_wealth_summary', event.target.value)
            }
            disabled={disabled || submitting}
            rows={3}
            className="w-full rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-3 text-futurex-ink outline-none transition placeholder:text-futurex-muted disabled:opacity-50 focus:border-futurex-gold"
            placeholder="Example: My wealth comes primarily from employment income and long term savings."
          />
        </div>
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
