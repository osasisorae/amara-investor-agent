'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PaymentMethodSelectorComponentData } from '@/lib/chat/components';
import type { SerializablePaymentDetails } from '@/lib/payment-details';
import { getUsdTransferNotice } from '@/lib/payment-copy';
import {
  getPaymentMethodLabel,
  type PaymentMethod,
} from '@/lib/payment-methods';
import { useFeedback } from '@/components/feedback-provider';

interface PaymentMethodSelectorCardProps {
  leadId: string;
  data: PaymentMethodSelectorComponentData;
}

interface PaymentConfirmationResponse {
  leadStage: string;
  paymentDetails: SerializablePaymentDetails;
  confirmation: {
    confirmed: boolean;
    method?: PaymentMethod;
    reference?: string;
    createdAt?: number;
  };
}

interface PaymentConfirmationMutationResponse {
  success?: boolean;
  confirmation?: {
    confirmed: boolean;
    method?: PaymentMethod;
  };
  error?: string;
}

function formatNaira(value: number): string {
  return `₦${value.toLocaleString('en-NG')}`;
}

function formatApproximateUsd(slotCount: number): string {
  const total = slotCount * 3300;

  if (slotCount <= 1) {
    return '$3,300 per slot';
  }

  return `$${total.toLocaleString('en-US')} total (about $3,300 per slot)`;
}

function getConfirmationAmountLabel(
  selectedMethod: PaymentMethod,
  commitmentAmountNgn: number,
  slotCount: number
): string {
  if (selectedMethod === 'ngn') {
    return formatNaira(commitmentAmountNgn);
  }

  if (selectedMethod === 'usd') {
    return formatApproximateUsd(slotCount);
  }

  return `the stablecoin equivalent of ${formatApproximateUsd(slotCount)}`;
}

function InfoRow(props: {
  label: string;
  value: string;
  copyValue?: string;
  copied: boolean;
  onCopy: (value: string, key: string) => void;
  copyKey: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-3">
      <div>
        <div className="text-[11px] uppercase tracking-[0.16em] text-futurex-muted">
          {props.label}
        </div>
        <div className="mt-2 break-all text-sm leading-6 text-futurex-ink">
          {props.value}
        </div>
      </div>
      {props.copyValue ? (
        <button
          type="button"
          onClick={() => props.onCopy(props.copyValue!, props.copyKey)}
          className="rounded-full border border-futurex-line px-3 py-1 text-xs font-medium text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold"
        >
          {props.copied ? 'Copied' : 'Copy'}
        </button>
      ) : null}
    </div>
  );
}

export function PaymentMethodSelectorCard({
  leadId,
  data,
}: PaymentMethodSelectorCardProps) {
  const { notify } = useFeedback();
  const [paymentDetails, setPaymentDetails] =
    useState<SerializablePaymentDetails | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(
    null
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [showConfirmPrompt, setShowConfirmPrompt] = useState(false);
  const [submittingConfirmation, setSubmittingConfirmation] = useState(false);
  const [confirmedState, setConfirmedState] = useState<{
    confirmed: boolean;
    method?: PaymentMethod;
    leadStage?: string;
  }>({
    confirmed: false,
  });

  const showCrypto = data.slotCount >= 2;
  const usdTransferNotice = useMemo(
    () => getUsdTransferNotice(showCrypto),
    [showCrypto]
  );

  useEffect(() => {
    let cancelled = false;

    const loadPaymentState = async () => {
      try {
        setLoading(true);
        setLoadingError(null);

        const response = await fetch(`/api/payment/${leadId}/confirm-sent`, {
          cache: 'no-store',
        });
        const payload = (await response.json()) as
          | PaymentConfirmationResponse
          | { error?: string };

        if (!response.ok) {
          if (!cancelled) {
            setLoadingError(
              'error' in payload && typeof payload.error === 'string'
                ? payload.error
                : 'Failed to load payment details.'
            );
          }
          return;
        }

        if (cancelled) {
          return;
        }

        const nextPayload = payload as PaymentConfirmationResponse;

        setPaymentDetails(nextPayload.paymentDetails);
        setConfirmedState({
          confirmed: nextPayload.confirmation.confirmed,
          method: nextPayload.confirmation.method,
          leadStage: nextPayload.leadStage,
        });

        if (nextPayload.confirmation.method) {
          setSelectedMethod(nextPayload.confirmation.method);
        }
      } catch (error) {
        console.error('Failed to load payment details:', error);
        if (!cancelled) {
          setLoadingError('Failed to load payment details.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPaymentState();

    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const handleCopy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1600);
    } catch (error) {
      console.error('Failed to copy payment detail:', error);
      notify({
        title: 'Copy failed',
        message: 'Could not copy to clipboard.',
        tone: 'error',
      });
    }
  };

  const confirmPaymentSent = async () => {
    if (!selectedMethod || submittingConfirmation) {
      return;
    }

    setSubmittingConfirmation(true);

    try {
      const response = await fetch(`/api/payment/${leadId}/confirm-sent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: selectedMethod,
          reference: data.paymentReference,
        }),
      });
      const payload =
        (await response.json()) as PaymentConfirmationMutationResponse;

      if (!response.ok) {
        notify({
          title: 'Confirmation not recorded',
          message:
            'error' in payload && typeof payload.error === 'string'
              ? payload.error
              : 'Failed to record your payment confirmation.',
          tone: 'error',
        });
        return;
      }

      setConfirmedState((current) => ({
        ...current,
        confirmed: true,
        method: payload.confirmation?.method || selectedMethod,
      }));
      setShowConfirmPrompt(false);
      notify({
        title: 'Payment confirmation received',
        message: 'FutureX is verifying your transfer.',
        tone: 'success',
      });
    } catch (error) {
      console.error('Failed to confirm investor payment:', error);
      notify({
        title: 'Confirmation not recorded',
        message: 'Failed to record your payment confirmation.',
        tone: 'error',
      });
    } finally {
      setSubmittingConfirmation(false);
    }
  };

  const renderFrozenConfirmation = () => {
    const methodLabel = confirmedState.method
      ? getPaymentMethodLabel(confirmedState.method)
      : selectedMethod
        ? getPaymentMethodLabel(selectedMethod)
        : 'your selected payment method';

    return (
      <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-emerald-100">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xl text-emerald-300">
            ✓
          </div>
          <div>
            <div className="text-sm font-semibold text-emerald-200">
              Payment confirmation received
            </div>
            <p className="mt-2 text-sm leading-6 text-emerald-100/90">
              FutureX is verifying your transfer via {methodLabel}.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderMethodSelection = () => {
    const options: Array<{
      method: PaymentMethod;
      title: string;
      description: string;
    }> = [
      {
        method: 'ngn',
        title: 'Nigerian Naira (NGN)',
        description: 'Bank transfer',
      },
      {
        method: 'usd',
        title: 'US Dollars (USD)',
        description: 'Wire transfer',
      },
    ];

    if (showCrypto) {
      options.push({
        method: 'crypto',
        title: 'Crypto (USDC/USDT)',
        description: 'Stablecoin transfer',
      });
    }

    return (
      <div className="mt-4 grid gap-3">
        {options.map((option) => (
          <button
            key={option.method}
            type="button"
            onClick={() => {
              setSelectedMethod(option.method);
              setShowConfirmPrompt(false);
            }}
            disabled={loading || !paymentDetails || confirmedState.confirmed}
            className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4 text-left transition hover:border-futurex-gold disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="text-sm font-semibold text-futurex-ink">
              {option.title}
            </div>
            <div className="mt-2 text-sm leading-6 text-futurex-muted">
              {option.description}
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderSelectedMethod = () => {
    if (!selectedMethod || !paymentDetails) {
      return null;
    }

    if (selectedMethod === 'ngn') {
      return (
        <div className="mt-4 rounded-2xl border border-futurex-line bg-futurex-surface p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-futurex-gold">
            Nigerian Naira (NGN)
          </div>
          <div className="mt-3 space-y-3">
            <InfoRow
              label="Bank"
              value={paymentDetails.ngn.bank}
              copied={false}
              onCopy={handleCopy}
              copyKey="ngn_bank"
            />
            <InfoRow
              label="Account name"
              value={paymentDetails.ngn.accountName}
              copied={false}
              onCopy={handleCopy}
              copyKey="ngn_account_name"
            />
            <InfoRow
              label="Account number"
              value={paymentDetails.ngn.accountNumber}
              copyValue={paymentDetails.ngn.accountNumber}
              copied={copiedKey === 'ngn_account_number'}
              onCopy={handleCopy}
              copyKey="ngn_account_number"
            />
            <InfoRow
              label="Amount"
              value={formatNaira(data.commitmentAmountNgn)}
              copied={false}
              onCopy={handleCopy}
              copyKey="ngn_amount"
            />
          </div>
        </div>
      );
    }

    if (selectedMethod === 'usd') {
      return (
        <div className="mt-4 rounded-2xl border border-futurex-line bg-futurex-surface p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-futurex-gold">
            US Dollars (USD)
          </div>
          <div className="mt-3 space-y-3">
            <InfoRow
              label="Bank"
              value={paymentDetails.usd.bank}
              copied={false}
              onCopy={handleCopy}
              copyKey="usd_bank"
            />
            <InfoRow
              label="Account name"
              value={paymentDetails.usd.accountName}
              copied={false}
              onCopy={handleCopy}
              copyKey="usd_account_name"
            />
            <InfoRow
              label="Account number"
              value={paymentDetails.usd.accountNumber}
              copyValue={paymentDetails.usd.accountNumber}
              copied={copiedKey === 'usd_account_number'}
              onCopy={handleCopy}
              copyKey="usd_account_number"
            />
            <InfoRow
              label="Routing"
              value={paymentDetails.usd.routingNumber}
              copyValue={paymentDetails.usd.routingNumber}
              copied={copiedKey === 'usd_routing'}
              onCopy={handleCopy}
              copyKey="usd_routing"
            />
            <InfoRow
              label="Approximate amount"
              value={formatApproximateUsd(data.slotCount)}
              copied={false}
              onCopy={handleCopy}
              copyKey="usd_amount"
            />
          </div>
          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
            {usdTransferNotice}
          </div>
        </div>
      );
    }

    return (
      <div className="mt-4 rounded-2xl border border-futurex-line bg-futurex-surface p-4">
        <div className="text-xs uppercase tracking-[0.16em] text-futurex-gold">
          Crypto (USDC/USDT)
        </div>
        <div className="mt-3 space-y-3">
          <InfoRow
            label="USDC on Ethereum"
            value={paymentDetails.crypto.usdc_eth}
            copyValue={paymentDetails.crypto.usdc_eth}
            copied={copiedKey === 'usdc_eth'}
            onCopy={handleCopy}
            copyKey="usdc_eth"
          />
          <InfoRow
            label="USDC on Solana"
            value={paymentDetails.crypto.usdc_sol}
            copyValue={paymentDetails.crypto.usdc_sol}
            copied={copiedKey === 'usdc_sol'}
            onCopy={handleCopy}
            copyKey="usdc_sol"
          />
          <InfoRow
            label="USDC on BNB Chain"
            value={paymentDetails.crypto.usdc_bnb}
            copyValue={paymentDetails.crypto.usdc_bnb}
            copied={copiedKey === 'usdc_bnb'}
            onCopy={handleCopy}
            copyKey="usdc_bnb"
          />
          <InfoRow
            label="USDT on BNB Chain"
            value={paymentDetails.crypto.usdt_bnb}
            copyValue={paymentDetails.crypto.usdt_bnb}
            copied={copiedKey === 'usdt_bnb'}
            onCopy={handleCopy}
            copyKey="usdt_bnb"
          />
          <InfoRow
            label="USDT on TRON (TRX)"
            value={paymentDetails.crypto.usdt_trx}
            copyValue={paymentDetails.crypto.usdt_trx}
            copied={copiedKey === 'usdt_trx'}
            onCopy={handleCopy}
            copyKey="usdt_trx"
          />
        </div>
        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100">
          Only send the exact token on the correct network. Sending to the
          wrong network results in permanent loss.
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-[24px] border border-futurex-gold-border bg-futurex-surface2 p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
        Complete payment in chat
      </div>

      <div className="mt-4 rounded-2xl border border-futurex-gold-border bg-futurex-gold-soft px-4 py-4">
        <div className="text-xs uppercase tracking-[0.16em] text-futurex-gold">
          Your reference
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="text-base font-semibold text-futurex-ink">
            {data.paymentReference}
          </div>
          <button
            type="button"
            onClick={() => handleCopy(data.paymentReference, 'payment_reference')}
            className="rounded-full border border-futurex-gold px-3 py-1 text-xs font-medium text-futurex-gold transition hover:bg-futurex-surface"
          >
            {copiedKey === 'payment_reference' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-futurex-ink/80">
          Include this exact reference in your transfer description.
        </p>
      </div>

      {loading ? (
        <div className="mt-4 rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4 text-sm text-futurex-muted">
          Loading payment options...
        </div>
      ) : loadingError ? (
        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
          {loadingError}
        </div>
      ) : selectedMethod ? (
        <>
          {renderSelectedMethod()}

          {confirmedState.confirmed ? (
            renderFrozenConfirmation()
          ) : (
            <div className="mt-4">
              {showConfirmPrompt ? (
                <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4">
                  <div className="text-sm font-semibold text-futurex-ink">
                    Please confirm
                  </div>
                  <p className="mt-2 text-sm leading-6 text-futurex-muted">
                    You have sent{' '}
                    <span className="text-futurex-ink">
                      {getConfirmationAmountLabel(
                        selectedMethod,
                        data.commitmentAmountNgn,
                        data.slotCount
                      )}
                    </span>{' '}
                    to FutureX using{' '}
                    <span className="text-futurex-ink">
                      {getPaymentMethodLabel(selectedMethod)}
                    </span>{' '}
                    with reference{' '}
                    <span className="text-futurex-ink">
                      {data.paymentReference}
                    </span>
                    .
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={confirmPaymentSent}
                      disabled={submittingConfirmation}
                      className="rounded-full bg-futurex-gold px-4 py-2 text-sm font-semibold text-futurex-bg transition hover:opacity-90 disabled:opacity-50"
                    >
                      {submittingConfirmation ? 'Confirming...' : 'Yes, confirm'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConfirmPrompt(false)}
                      disabled={submittingConfirmation}
                      className="rounded-full border border-futurex-line px-4 py-2 text-sm font-medium text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowConfirmPrompt(true)}
                  className="w-full rounded-full bg-futurex-gold px-4 py-3 text-sm font-semibold text-futurex-bg transition hover:opacity-90"
                >
                  I&apos;ve made this payment
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedMethod(null);
                  setShowConfirmPrompt(false);
                }}
                className="mt-3 text-sm text-futurex-gold transition hover:text-futurex-ink"
              >
                Change method
              </button>
            </div>
          )}
        </>
      ) : (
        renderMethodSelection()
      )}
    </div>
  );
}
