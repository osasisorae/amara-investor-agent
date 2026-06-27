'use client';

import { useState } from 'react';
import type { KycPaymentAccountComponentData } from '@/lib/chat/components';
import {
  KYC_YES_NO_OPTIONS,
  isKycPaymentMethod,
  type KycPaymentMethod,
  type KycYesNoValue,
} from '@/lib/kyc/requirements';

interface PaymentAccountState {
  expected_funding_method: KycPaymentMethod | '';
  expected_funding_bank_country: string;
  expected_funding_account_name: string;
  payment_from_own_account: KycYesNoValue | '';
}

interface KYCPaymentAccountCardProps {
  leadId: string;
  data?: KycPaymentAccountComponentData;
  disabled?: boolean;
  onSendPrompt: (message: string) => Promise<void>;
}

export function KYCPaymentAccountCard({
  leadId,
  data,
  disabled = false,
  onSendPrompt,
}: KYCPaymentAccountCardProps) {
  const [values, setValues] = useState<PaymentAccountState>({
    expected_funding_method: data?.expectedFundingMethod || '',
    expected_funding_bank_country: data?.expectedFundingBankCountry || '',
    expected_funding_account_name: data?.expectedFundingAccountName || '',
    payment_from_own_account: data?.paymentFromOwnAccount || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const setField = (field: keyof PaymentAccountState, value: string) => {
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

    if (!values.expected_funding_method) {
      nextErrors.expected_funding_method = 'Select the funding method';
    }

    if (!values.expected_funding_bank_country.trim()) {
      nextErrors.expected_funding_bank_country =
        'Enter the country where the sending account is held';
    }

    if (!values.expected_funding_account_name.trim()) {
      nextErrors.expected_funding_account_name =
        'Enter the account holder name for the sending account';
    }

    if (!values.payment_from_own_account) {
      nextErrors.payment_from_own_account =
        'Confirm whether the payment comes from your own named account';
    }

    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const response = await fetch(`/api/kyc/${leadId}/payment-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setSubmitError(payload.error || 'Failed to save payment account details.');
        return;
      }

      await onSendPrompt('Payment account submitted');
    } catch (error) {
      console.error('Failed to save payment account details:', error);
      setSubmitError('Failed to save payment account details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
        Payment account
      </div>
      <h3 className="mt-3 font-serif text-2xl text-futurex-ink">
        {data?.title || 'Confirm the account that will send your funds'}
      </h3>
      <p className="mt-2 text-sm leading-6 text-futurex-muted">
        FutureX expects the first payment to come from the same investor name used in KYC unless approved otherwise.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {(data?.fundingMethods || []).map((option) => {
          const isSelected = values.expected_funding_method === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                isKycPaymentMethod(option.value) &&
                setField('expected_funding_method', option.value)
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
      {errors.expected_funding_method ? (
        <div className="mt-2 text-xs text-rose-300">
          {errors.expected_funding_method}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm text-futurex-muted">
            Sending bank country
          </label>
          <input
            type="text"
            value={values.expected_funding_bank_country}
            onChange={(event) =>
              setField('expected_funding_bank_country', event.target.value)
            }
            disabled={disabled || submitting}
            className={`w-full rounded-xl border bg-futurex-surface px-4 py-3 text-futurex-ink outline-none transition placeholder:text-futurex-muted disabled:opacity-50 ${
              errors.expected_funding_bank_country
                ? 'border-rose-500'
                : 'border-futurex-line focus:border-futurex-gold'
            }`}
            placeholder="United Kingdom"
          />
          {errors.expected_funding_bank_country ? (
            <div className="mt-2 text-xs text-rose-300">
              {errors.expected_funding_bank_country}
            </div>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm text-futurex-muted">
            Account holder name
          </label>
          <input
            type="text"
            value={values.expected_funding_account_name}
            onChange={(event) =>
              setField('expected_funding_account_name', event.target.value)
            }
            disabled={disabled || submitting}
            className={`w-full rounded-xl border bg-futurex-surface px-4 py-3 text-futurex-ink outline-none transition placeholder:text-futurex-muted disabled:opacity-50 ${
              errors.expected_funding_account_name
                ? 'border-rose-500'
                : 'border-futurex-line focus:border-futurex-gold'
            }`}
            placeholder="Your full legal name or entity name"
          />
          {errors.expected_funding_account_name ? (
            <div className="mt-2 text-xs text-rose-300">
              {errors.expected_funding_account_name}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4">
        <div className="text-sm font-semibold text-futurex-ink">
          Will the first payment come from an account in your own name
        </div>
        <div className="mt-2 text-sm leading-6 text-futurex-muted">
          Third party transfers trigger additional compliance review before FutureX can confirm an allocation.
        </div>
        <div className="mt-4 flex gap-2">
          {KYC_YES_NO_OPTIONS.map((option) => {
            const selected = values.payment_from_own_account === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setField('payment_from_own_account', option.value)
                }
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
        {errors.payment_from_own_account ? (
          <div className="mt-2 text-xs text-rose-300">
            {errors.payment_from_own_account}
          </div>
        ) : null}
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
