import Link from 'next/link';
import { processFlutterwavePaymentCallback } from '@/lib/payment';

interface PaymentCallbackPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function getSingleParam(
  value: string | string[] | undefined
): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  return Array.isArray(value) ? value[0] : undefined;
}

export default async function PaymentCallbackPage({
  searchParams,
}: PaymentCallbackPageProps) {
  const leadId = getSingleParam(searchParams.leadId);
  const transactionId =
    getSingleParam(searchParams.transaction_id) ||
    getSingleParam(searchParams.transactionId);
  const transactionReference =
    getSingleParam(searchParams.tx_ref) || getSingleParam(searchParams.txRef);
  const returnStatus = getSingleParam(searchParams.status)?.toLowerCase();

  let tone: 'success' | 'warning' | 'error' = 'warning';
  let title = 'Payment pending';
  let message =
    'Your payment is still being processed. Please return to your agreement page in a moment.';
  let detailRows: Array<{ label: string; value: string }> = [];

  if (!leadId) {
    tone = 'error';
    title = 'Payment callback incomplete';
    message =
      'The payment gateway did not return the lead reference needed to complete verification.';
  } else if (!transactionId) {
    if (returnStatus === 'cancelled' || returnStatus === 'failed') {
      tone = 'error';
      title = 'Payment not completed';
      message =
        'Your checkout was not completed. You can return to your agreement page to try again.';
    } else {
      tone = 'warning';
      title = 'Waiting for payment confirmation';
      message =
        'Flutterwave redirected you back before a transaction ID was provided. Please check the agreement page again in a moment.';
    }
  } else {
    try {
      const result = await processFlutterwavePaymentCallback({
        leadId,
        transactionId,
        transactionReference,
      });

      detailRows = [
        { label: 'Payment reference', value: result.paymentReference },
        { label: 'Flutterwave transaction', value: result.transactionId },
        { label: 'Recorded commitment', value: result.commitmentLabel },
        { label: 'Currency', value: result.currency },
      ];

      switch (result.status) {
        case 'submitted':
          tone = 'success';
          title = 'Payment submitted';
          message =
            'Flutterwave has confirmed your payment. FutureX is now validating settlement and will confirm your allocation shortly.';
          break;
        case 'pending':
          tone = 'warning';
          title = 'Payment still pending';
          message =
            'Flutterwave has not marked this payment as complete yet. You can return to the agreement page and check again shortly.';
          break;
        case 'failed':
          tone = 'error';
          title = 'Payment not completed';
          message =
            'Flutterwave did not return a successful payment status for this transaction. Please try the checkout again.';
          break;
        case 'invalid':
          tone = 'error';
          title = 'Payment verification failed';
          message =
            'The returned payment details did not match the expected commitment for this investor record.';
          break;
      }
    } catch (error) {
      tone = 'error';
      title = 'Payment verification failed';
      message =
        error instanceof Error
          ? error.message
          : 'We could not verify the Flutterwave transaction.';
    }
  }

  const toneClasses =
    tone === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
      : tone === 'error'
        ? 'border-rose-500/30 bg-rose-500/10 text-rose-100'
        : 'border-futurex-gold-border bg-futurex-gold-soft text-futurex-ink';

  return (
    <div className="min-h-screen bg-futurex-bg px-6 py-12">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-futurex-line bg-futurex-surface p-8 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="text-xs uppercase tracking-[0.24em] text-futurex-gold">
          Flutterwave callback
        </div>
        <h1 className="mt-3 font-serif text-4xl text-futurex-ink">{title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-futurex-muted">
          {message}
        </p>

        <div className={`mt-6 rounded-[24px] border px-5 py-4 ${toneClasses}`}>
          <div className="text-sm font-medium">Current status</div>
          <div className="mt-2 text-sm capitalize">
            {tone === 'success'
              ? 'Submitted to FutureX'
              : tone === 'error'
                ? 'Needs attention'
                : 'Awaiting confirmation'}
          </div>
        </div>

        {detailRows.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {detailRows.map((row) => (
              <div
                key={row.label}
                className="rounded-[20px] border border-futurex-line bg-futurex-surface2 px-4 py-3"
              >
                <div className="text-xs uppercase tracking-[0.18em] text-futurex-muted">
                  {row.label}
                </div>
                <div className="mt-2 text-sm text-futurex-ink">{row.value}</div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          {leadId ? (
            <>
              <Link
                href={`/agreement/${leadId}`}
                className="rounded-full bg-futurex-gold px-5 py-3 text-sm font-semibold text-futurex-bg transition hover:opacity-90"
              >
                Back to agreement
              </Link>
              <Link
                href={`/chat/${leadId}`}
                className="rounded-full border border-futurex-line px-5 py-3 text-sm font-medium text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold"
              >
                Return to chat
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
