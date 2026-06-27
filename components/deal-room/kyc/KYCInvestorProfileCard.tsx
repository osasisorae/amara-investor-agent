'use client';

import { useState } from 'react';
import type { KycInvestorProfileComponentData } from '@/lib/chat/components';

interface InvestorProfileState {
  occupation: string;
  employer_or_business_name: string;
  employer_or_business_address: string;
  tax_residency_country: string;
  tax_identification_number: string;
}

type InvestorProfileField = keyof InvestorProfileState;

interface KYCInvestorProfileCardProps {
  leadId: string;
  data?: KycInvestorProfileComponentData;
  disabled?: boolean;
  onSendPrompt: (message: string) => Promise<void>;
}

const PROFILE_FIELDS: Array<{
  key: InvestorProfileField;
  label: string;
  type?: 'text';
  optional?: boolean;
}> = [
  { key: 'occupation', label: 'Occupation', optional: true },
  {
    key: 'employer_or_business_name',
    label: 'Employer or business name',
    optional: true,
  },
  {
    key: 'employer_or_business_address',
    label: 'Employer or business address',
    optional: true,
  },
  {
    key: 'tax_residency_country',
    label: 'Tax residency country',
    optional: true,
  },
  {
    key: 'tax_identification_number',
    label: 'Tax identification number',
    optional: true,
  },
];

export function KYCInvestorProfileCard({
  leadId,
  data,
  disabled = false,
  onSendPrompt,
}: KYCInvestorProfileCardProps) {
  const [values, setValues] = useState<InvestorProfileState>({
    occupation: data?.occupation || '',
    employer_or_business_name: data?.employerOrBusinessName || '',
    employer_or_business_address: data?.employerOrBusinessAddress || '',
    tax_residency_country: data?.taxResidencyCountry || '',
    tax_identification_number: data?.taxIdentificationNumber || '',
  });
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field: InvestorProfileField, value: string) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
    setSubmitError('');
  };

  const submit = async () => {
    if (disabled || submitting) {
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const response = await fetch(`/api/kyc/${leadId}/investor-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setSubmitError(payload.error || 'Failed to save investor profile.');
        return;
      }

      await onSendPrompt('Investor profile submitted');
    } catch (error) {
      console.error('Failed to save investor profile:', error);
      setSubmitError('Failed to save investor profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
        Investor profile
      </div>
      <h3 className="mt-3 font-serif text-2xl text-futurex-ink">
        {data?.title || 'Add your investor profile details'}
      </h3>
      <p className="mt-2 text-sm leading-6 text-futurex-muted">
        Share anything you have now. Missing profile details can be clarified by the compliance reviewer later.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {PROFILE_FIELDS.map((field) => (
          <div
            key={field.key}
            className={
              field.key === 'employer_or_business_address' ? 'sm:col-span-2' : ''
            }
          >
            <label className="mb-2 block text-sm text-futurex-muted">
              {field.label}
              {field.optional ? ' (optional)' : ''}
            </label>
            <input
              type={field.type || 'text'}
              value={values[field.key]}
              onChange={(event) => handleChange(field.key, event.target.value)}
              disabled={disabled || submitting}
              className="w-full rounded-xl border border-futurex-line bg-futurex-surface px-4 py-3 text-futurex-ink outline-none transition placeholder:text-futurex-muted disabled:opacity-50 focus:border-futurex-gold"
            />
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
