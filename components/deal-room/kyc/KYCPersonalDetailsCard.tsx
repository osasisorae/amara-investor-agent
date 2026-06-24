'use client';

import { useState } from 'react';
import type { KycPersonalDetailsComponentData } from '@/lib/chat/components';

type PersonalDetailsField =
  | 'full_legal_name'
  | 'date_of_birth'
  | 'nationality'
  | 'country_of_residence'
  | 'phone_number';

interface PersonalDetailsState {
  full_legal_name: string;
  date_of_birth: string;
  nationality: string;
  country_of_residence: string;
  phone_number: string;
}

interface KYCPersonalDetailsCardProps {
  leadId: string;
  data?: KycPersonalDetailsComponentData;
  disabled?: boolean;
  onSendPrompt: (message: string) => Promise<void>;
}

const REQUIRED_FIELDS: Array<{
  key: PersonalDetailsField;
  label: string;
  type?: 'text' | 'date' | 'tel';
}> = [
  {
    key: 'full_legal_name',
    label: 'Full legal name',
    type: 'text',
  },
  {
    key: 'date_of_birth',
    label: 'Date of birth',
    type: 'date',
  },
  {
    key: 'nationality',
    label: 'Nationality',
    type: 'text',
  },
  {
    key: 'country_of_residence',
    label: 'Country of residence',
    type: 'text',
  },
  {
    key: 'phone_number',
    label: 'Phone number',
    type: 'tel',
  },
];

export function KYCPersonalDetailsCard({
  leadId,
  data,
  disabled = false,
  onSendPrompt,
}: KYCPersonalDetailsCardProps) {
  const [values, setValues] = useState<PersonalDetailsState>({
    full_legal_name: data?.fullLegalName || '',
    date_of_birth: data?.dateOfBirth || '',
    nationality: data?.nationality || '',
    country_of_residence: data?.countryOfResidence || '',
    phone_number: data?.phoneNumber || '',
  });
  const [errors, setErrors] = useState<
    Partial<Record<PersonalDetailsField, string>>
  >({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field: PersonalDetailsField, value: string) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
    setSubmitError('');
  };

  const submit = async () => {
    if (disabled || submitting) {
      return;
    }

    const nextErrors: Partial<Record<PersonalDetailsField, string>> = {};

    for (const field of REQUIRED_FIELDS) {
      if (!values[field.key].trim()) {
        nextErrors[field.key] = `${field.label} is required`;
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const response = await fetch(`/api/kyc/${leadId}/personal-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setSubmitError(payload.error || 'Failed to save personal details.');
        return;
      }

      await onSendPrompt('Personal details submitted');
    } catch (error) {
      console.error('Failed to save personal details:', error);
      setSubmitError('Failed to save personal details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
        Personal details
      </div>
      <h3 className="mt-3 font-serif text-2xl text-futurex-ink">
        {data?.title || 'Tell us about yourself'}
      </h3>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {REQUIRED_FIELDS.map((field) => (
          <div
            key={field.key}
            className={field.key === 'phone_number' ? 'sm:col-span-2' : ''}
          >
            <label className="mb-2 block text-sm text-futurex-muted">
              {field.label}
            </label>
            <input
              type={field.type || 'text'}
              value={values[field.key]}
              onChange={(event) => handleChange(field.key, event.target.value)}
              disabled={disabled || submitting}
              className={`w-full rounded-xl border bg-futurex-surface px-4 py-3 text-futurex-ink outline-none transition placeholder:text-futurex-muted disabled:opacity-50 ${
                errors[field.key]
                  ? 'border-rose-500'
                  : 'border-futurex-line focus:border-futurex-gold'
              }`}
            />
            {errors[field.key] ? (
              <div className="mt-2 text-xs text-rose-300">
                {errors[field.key]}
              </div>
            ) : null}
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
