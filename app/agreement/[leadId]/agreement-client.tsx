'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  buildCommitmentSelection,
  coerceCommitmentSlotCount,
  getSlotLabel,
  type CommitmentSelection,
} from '@/lib/agreement/commitment';
import { getAgreementMarkdown } from '@/lib/agreement/template';
import type { LeadPaymentProgress } from '@/lib/payment';
import { markdownToHtml } from '@/lib/utils/markdown';
import { useFeedback } from '@/components/feedback-provider';

interface AgreementLead {
  id: string;
  email: string;
  full_name?: string;
  stage: string;
}

interface AgreementClientProps {
  lead: AgreementLead;
  agreementMarkdown: string;
  initialCommitment: CommitmentSelection;
  initialPaymentProgress: LeadPaymentProgress;
}

function getStageLabel(stage: string): string {
  switch (stage) {
    case 'agreement_pending':
      return 'Ready to sign';
    case 'agreement_signed':
      return 'Signed';
    case 'payment_pending':
      return 'Payment pending';
    case 'closed':
      return 'Closed';
    default:
      return stage.replace(/_/g, ' ');
  }
}

export default function AgreementClient({
  lead,
  agreementMarkdown,
  initialCommitment,
  initialPaymentProgress,
}: AgreementClientProps) {
  const { notify } = useFeedback();
  const [stage, setStage] = useState(lead.stage);
  const [fullName, setFullName] = useState(lead.full_name || '');
  const [slotCount, setSlotCount] = useState(initialCommitment.slotCount);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [signing, setSigning] = useState(false);
  const [paymentCheckoutLoading, setPaymentCheckoutLoading] = useState(false);
  const [paymentReference, setPaymentReference] = useState<string | null>(
    initialPaymentProgress.paymentReference
  );
  const [paymentUrl, setPaymentUrl] = useState<string | null>(
    initialPaymentProgress.checkoutUrl
  );
  const [paymentSubmittedAt, setPaymentSubmittedAt] = useState<number | null>(
    initialPaymentProgress.submittedAt
  );
  const [paymentSubmittedStatus, setPaymentSubmittedStatus] = useState<
    string | null
  >(initialPaymentProgress.submittedStatus);
  const [warning, setWarning] = useState<string | null>(null);

  const canSign = stage === 'agreement_pending';
  const hasSubmittedPayment = Boolean(paymentSubmittedAt);
  const commitment = buildCommitmentSelection(slotCount);
  const perSlotCommitmentLabel = buildCommitmentSelection(1).commitmentLabel;
  const agreementPreviewMarkdown = getAgreementMarkdown({
    lead: {
      email: lead.email,
      full_name: fullName.trim() || lead.full_name,
    },
    commitmentLabel: commitment.commitmentLabel,
    slotCount: commitment.slotCount,
  });
  const agreementPreviewHtml = markdownToHtml(
    agreementPreviewMarkdown || agreementMarkdown
  );

  const resetOtpState = (showNotice: boolean) => {
    if (!otpSent && !otpCode) {
      return;
    }

    setOtpSent(false);
    setOtpCode('');

    if (showNotice) {
      notify({
        title: 'Verification reset',
        message:
          'Your commitment changed. Request a fresh verification code before signing.',
        tone: 'info',
      });
    }
  };

  const updateSlotCount = (nextValue: unknown) => {
    const nextSlotCount = coerceCommitmentSlotCount(nextValue);
    if (!nextSlotCount || nextSlotCount === slotCount) {
      return;
    }

    setSlotCount(nextSlotCount);
    resetOtpState(true);
  };

  const sendOtp = async () => {
    if (!canSign || otpSending) {
      return;
    }

    if (!fullName.trim()) {
      notify({
        title: 'Full name required',
        message: 'Enter your full legal name before requesting a verification code.',
        tone: 'info',
      });
      return;
    }

    setOtpSending(true);
    try {
      const response = await fetch(`/api/agreement/${lead.id}/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotCount: commitment.slotCount,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        notify({
          title: 'Code not sent',
          message: data.error || 'Failed to send verification code.',
          tone: 'error',
        });
        return;
      }

      setOtpSent(true);
      setWarning(null);
      notify({
        title: 'Verification code sent',
        message: 'Check your inbox for the 6-digit code.',
        tone: 'success',
      });
    } catch (error) {
      console.error('Failed to send OTP:', error);
      notify({
        title: 'Code not sent',
        message: 'Failed to send verification code.',
        tone: 'error',
      });
    } finally {
      setOtpSending(false);
    }
  };

  const signAgreement = async () => {
    if (!canSign || signing) {
      return;
    }

    if (!fullName.trim() || !otpCode.trim()) {
      notify({
        title: 'Missing details',
        message: 'Enter your full legal name and the verification code.',
        tone: 'info',
      });
      return;
    }

    setSigning(true);
    try {
      const response = await fetch(`/api/agreement/${lead.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          otpCode,
          slotCount: commitment.slotCount,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        notify({
          title: 'Agreement not signed',
          message: data.error || 'Failed to complete signing.',
          tone: 'error',
        });
        return;
      }

      setStage(data.stage || 'agreement_signed');
      setPaymentReference(data.paymentReference || null);
      setPaymentUrl(data.paymentUrl || null);
      setWarning(data.warning || null);
      setOtpCode('');
      notify({
        title: 'Agreement signed',
        message:
          data.stage === 'payment_pending'
            ? 'Signing complete. Payment instructions have been prepared.'
            : 'Signing complete.',
        tone: 'success',
      });
    } catch (error) {
      console.error('Failed to sign agreement:', error);
      notify({
        title: 'Agreement not signed',
        message: 'Failed to complete signing.',
        tone: 'error',
      });
    } finally {
      setSigning(false);
    }
  };

  const openPaymentCheckout = async () => {
    if (paymentCheckoutLoading || hasSubmittedPayment) {
      return;
    }

    if (paymentUrl) {
      window.location.href = paymentUrl;
      return;
    }

    setPaymentCheckoutLoading(true);
    try {
      const response = await fetch(`/api/payment/${lead.id}/checkout`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        notify({
          title: 'Payment checkout unavailable',
          message: data.error || 'Failed to prepare the payment checkout.',
          tone: 'error',
        });
        return;
      }

      setStage(data.stage || 'payment_pending');
      setPaymentReference(data.paymentReference || paymentReference);
      setPaymentUrl(data.paymentUrl || null);
      setWarning(data.warning || null);

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      notify({
        title: 'Payment checkout ready',
        message: 'Your secure Flutterwave checkout has been prepared.',
        tone: 'success',
      });
    } catch (error) {
      console.error('Failed to open payment checkout:', error);
      notify({
        title: 'Payment checkout unavailable',
        message: 'Failed to prepare the payment checkout.',
        tone: 'error',
      });
    } finally {
      setPaymentCheckoutLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_360px]">
      <section className="overflow-hidden rounded-[28px] border border-futurex-line bg-futurex-surface shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="border-b border-futurex-line px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-futurex-gold">
                Agreement Review
              </p>
              <h1 className="mt-2 font-serif text-3xl text-futurex-ink">
                FutureX Subscription Agreement
              </h1>
            </div>
            <div className="rounded-full border border-futurex-gold-border bg-futurex-gold-soft px-3 py-1 text-xs font-semibold text-futurex-gold">
              {getStageLabel(stage)}
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-b border-futurex-line px-6 py-5 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-futurex-muted">
              Investor
            </div>
            <div className="mt-2 text-sm text-futurex-ink">{lead.email}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-futurex-muted">
              Commitment
            </div>
            <div className="mt-2 text-sm text-futurex-ink">
              {commitment.commitmentLabel}
            </div>
            <div className="mt-1 text-xs text-futurex-muted">
              {getSlotLabel(commitment.slotCount)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-futurex-muted">
              Secure Link
            </div>
            <div className="mt-2 text-sm text-futurex-ink">Investor-specific</div>
          </div>
        </div>

        <div
          className="markdown-content max-h-[70vh] overflow-y-auto px-6 py-6 text-sm leading-7 text-futurex-ink"
          dangerouslySetInnerHTML={{ __html: agreementPreviewHtml }}
        />
      </section>

      <aside className="space-y-4">
        <div className="rounded-[28px] border border-futurex-line bg-futurex-surface p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
          <div className="text-xs uppercase tracking-[0.22em] text-futurex-gold">
            Signature Flow
          </div>
          <h2 className="mt-3 font-serif text-2xl text-futurex-ink">
            Verify and sign
          </h2>
          <p className="mt-3 text-sm leading-6 text-futurex-muted">
            Enter your full legal name, request a one-time verification code,
            then complete signing. The code is delivered to {lead.email}.
          </p>

          <div className="mt-5 space-y-4">
            <div className="rounded-[22px] border border-futurex-line bg-futurex-surface2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-futurex-ink">
                    Final commitment
                  </div>
                  <p className="mt-1 text-sm leading-6 text-futurex-muted">
                    Choose how many slots you want to subscribe for before you
                    request your verification code.
                  </p>
                </div>
                {otpSent && canSign ? (
                  <button
                    type="button"
                    onClick={() => resetOtpState(false)}
                    className="rounded-full border border-futurex-line px-3 py-1 text-xs font-medium text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold"
                  >
                    Edit commitment
                  </button>
                ) : null}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => updateSlotCount(slotCount - 1)}
                  disabled={!canSign || otpSent || slotCount <= 1}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-futurex-line text-lg text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold disabled:opacity-40"
                >
                  -
                </button>
                <label className="flex-1">
                  <span className="mb-2 block text-sm text-futurex-muted">
                    Number of slots
                  </span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={slotCount}
                    onChange={(event) => updateSlotCount(event.target.value)}
                    disabled={!canSign || otpSent}
                    inputMode="numeric"
                    className="w-full rounded-xl border border-futurex-line bg-futurex-surface px-4 py-3 text-futurex-ink outline-none transition focus:border-futurex-gold disabled:opacity-60"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => updateSlotCount(slotCount + 1)}
                  disabled={!canSign || otpSent}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-futurex-line text-lg text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold disabled:opacity-40"
                >
                  +
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-futurex-muted">
                    Per slot
                  </div>
                  <div className="mt-2 text-sm font-medium text-futurex-ink">
                    {perSlotCommitmentLabel}
                  </div>
                </div>
                <div className="rounded-2xl border border-futurex-gold-border bg-futurex-gold-soft px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-futurex-gold">
                    Total commitment
                  </div>
                  <div className="mt-2 text-sm font-semibold text-futurex-gold">
                    {commitment.commitmentLabel}
                  </div>
                  <div className="mt-1 text-xs text-futurex-gold/80">
                    {getSlotLabel(commitment.slotCount)}
                  </div>
                </div>
              </div>

              {otpSent && canSign ? (
                <p className="mt-3 text-xs leading-5 text-futurex-muted">
                  This commitment is currently locked to the active verification
                  code. Use “Edit commitment” if you need to change the amount.
                </p>
              ) : null}
            </div>

            <label className="block">
              <span className="mb-2 block text-sm text-futurex-muted">
                Full legal name
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={!canSign}
                className="w-full rounded-xl border border-futurex-line bg-futurex-surface2 px-4 py-3 text-futurex-ink outline-none transition focus:border-futurex-gold disabled:opacity-60"
                placeholder="Jane Doe"
              />
            </label>

            <button
              type="button"
              onClick={sendOtp}
              disabled={!canSign || otpSending}
              className="w-full rounded-full border border-futurex-gold px-4 py-3 text-sm font-semibold text-futurex-gold transition hover:bg-futurex-gold-soft disabled:opacity-50"
            >
              {otpSending ? 'Sending code...' : otpSent ? 'Resend code' : 'Send verification code'}
            </button>

            <label className="block">
              <span className="mb-2 block text-sm text-futurex-muted">
                Verification code
              </span>
              <input
                type="text"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
                disabled={!canSign}
                inputMode="numeric"
                className="w-full rounded-xl border border-futurex-line bg-futurex-surface2 px-4 py-3 text-futurex-ink outline-none transition focus:border-futurex-gold disabled:opacity-60"
                placeholder="6-digit code"
              />
            </label>

            <button
              type="button"
              onClick={signAgreement}
              disabled={!canSign || signing}
              className="w-full rounded-full bg-futurex-gold px-4 py-3 text-sm font-semibold text-futurex-bg transition hover:opacity-90 disabled:opacity-50"
            >
              {signing ? 'Signing...' : 'Complete signing'}
            </button>
          </div>
        </div>

        {(stage !== 'agreement_pending' || paymentReference || warning) && (
          <div className="rounded-[24px] border border-futurex-line bg-futurex-surface p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-futurex-gold">
              Status
            </div>
            <p className="mt-3 text-sm leading-6 text-futurex-muted">
              {stage === 'payment_pending' && hasSubmittedPayment
                ? 'Flutterwave has confirmed your payment submission. FutureX is validating settlement before final allocation confirmation.'
                : stage === 'payment_pending'
                  ? 'Your agreement is signed and your secure Flutterwave checkout is ready.'
                  : stage === 'agreement_signed'
                    ? 'Your agreement is signed. Prepare your Flutterwave checkout to continue.'
                    : stage === 'closed'
                      ? 'This investment record has been closed.'
                      : 'This agreement has already been signed.'}
            </p>
            {paymentReference && (
              <div className="mt-4 rounded-2xl border border-futurex-gold-border bg-futurex-gold-soft px-4 py-3 text-sm text-futurex-gold">
                Payment reference: <span className="font-semibold">{paymentReference}</span>
              </div>
            )}
            {!hasSubmittedPayment &&
            (stage === 'agreement_signed' || stage === 'payment_pending') ? (
              <button
                type="button"
                onClick={openPaymentCheckout}
                disabled={paymentCheckoutLoading}
                className="mt-4 w-full rounded-full bg-futurex-gold px-4 py-3 text-sm font-semibold text-futurex-bg transition hover:opacity-90 disabled:opacity-50"
              >
                {paymentCheckoutLoading
                  ? 'Preparing checkout...'
                  : paymentUrl
                    ? 'Continue to Flutterwave checkout'
                    : 'Prepare Flutterwave checkout'}
              </button>
            ) : null}
            {hasSubmittedPayment ? (
              <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                Payment submitted{paymentSubmittedStatus
                  ? ` (${paymentSubmittedStatus})`
                  : ''}. FutureX will close the allocation after internal settlement confirmation.
              </div>
            ) : null}
            {warning && (
              <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {warning}
              </div>
            )}
          </div>
        )}

        <div className="rounded-[24px] border border-futurex-line bg-futurex-surface p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-futurex-gold">
            Need context?
          </div>
          <p className="mt-3 text-sm leading-6 text-futurex-muted">
            You can return to your conversation with Amara at any time for more
            deal context or operational questions.
          </p>
          <Link
            href={`/chat/${lead.id}`}
            className="mt-4 inline-flex rounded-full border border-futurex-line px-4 py-2 text-sm font-medium text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold"
          >
            Back to chat
          </Link>
        </div>
      </aside>
    </div>
  );
}
