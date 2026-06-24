import { SPV_CODE } from '@/lib/agreement/template';
import {
  AGREEMENT_COMMITMENT_AMOUNT_NGN_QUESTION,
  AGREEMENT_SLOT_COUNT_QUESTION,
  buildCommitmentSelection,
  DEFAULT_COMMITMENT_SLOT_COUNT,
  type CommitmentSelection,
} from '@/lib/agreement/commitment';
import {
  createFlutterwaveCheckoutSession,
  verifyFlutterwaveTransaction,
} from '@/lib/flutterwave';
import { getAuditTrail, logAuditEvent } from '@/lib/db/audit';
import { getLeadById, type Lead } from '@/lib/db/leads';
import { saveMessage } from '@/lib/db/messages';
import {
  getLatestQualificationAnswerMap,
  saveQualificationAnswer,
} from '@/lib/db/qualification';
import { sendEmail } from '@/lib/email/resend-client';
import { getPaymentInstructionsEmailTemplate } from '@/lib/email/templates';

export interface PaymentInstructionResult {
  paymentReference: string;
  commitmentLabel: string;
  checkoutUrl: string;
  transactionReference: string;
  warning?: string;
}

export interface LeadPaymentProgress {
  paymentReference: string;
  checkoutUrl: string | null;
  transactionReference: string | null;
  submittedAt: number | null;
  submittedTransactionId: string | null;
  submittedStatus: string | null;
  confirmedAt: number | null;
  confirmedBy: string | null;
}

export interface FlutterwavePaymentCallbackResult {
  lead: Lead;
  paymentReference: string;
  commitmentLabel: string;
  amount: number;
  currency: string;
  status: 'submitted' | 'pending' | 'failed' | 'invalid';
  transactionReference: string;
  transactionId: string;
}

function parseStoredPositiveInteger(value?: string): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseAuditMetadata(
  metadata?: string | null
): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  try {
    const parsed = JSON.parse(metadata) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    console.error('Failed to parse payment audit metadata:', error);
  }

  return null;
}

function normalizeAppBaseUrl(baseUrl?: string): string {
  return (
    baseUrl?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    ''
  );
}

export async function getLeadCommitmentSelection(
  leadId: string
): Promise<CommitmentSelection> {
  const latestAnswers = await getLatestQualificationAnswerMap(leadId);
  const savedSlotCount = parseStoredPositiveInteger(
    latestAnswers[AGREEMENT_SLOT_COUNT_QUESTION]?.answer
  );
  const savedCommitmentAmount = parseStoredPositiveInteger(
    latestAnswers[AGREEMENT_COMMITMENT_AMOUNT_NGN_QUESTION]?.answer
  );

  if (savedSlotCount) {
    const selection = buildCommitmentSelection(savedSlotCount);

    if (
      !savedCommitmentAmount ||
      savedCommitmentAmount === selection.commitmentAmountNgn
    ) {
      return selection;
    }
  }

  return buildCommitmentSelection(DEFAULT_COMMITMENT_SLOT_COUNT);
}

export async function saveLeadCommitmentSelection(params: {
  leadId: string;
  slotCount: number;
}): Promise<CommitmentSelection> {
  const selection = buildCommitmentSelection(params.slotCount);

  await saveQualificationAnswer({
    leadId: params.leadId,
    question: AGREEMENT_SLOT_COUNT_QUESTION,
    answer: String(selection.slotCount),
    passed: true,
  });
  await saveQualificationAnswer({
    leadId: params.leadId,
    question: AGREEMENT_COMMITMENT_AMOUNT_NGN_QUESTION,
    answer: String(selection.commitmentAmountNgn),
    passed: true,
  });

  return selection;
}

export async function resolveCommitmentLabel(leadId: string): Promise<string> {
  return (await getLeadCommitmentSelection(leadId)).commitmentLabel;
}

export function getPaymentReference(leadId: string): string {
  return `FTX-${SPV_CODE}-${leadId.slice(0, 8).toUpperCase()}`;
}

export async function getLeadPaymentProgress(
  leadId: string
): Promise<LeadPaymentProgress> {
  const paymentReference = getPaymentReference(leadId);
  const auditTrail = await getAuditTrail(leadId);

  const latestCheckoutEvent = [...auditTrail]
    .reverse()
    .find((event) => event.event_type === 'payment_instructions_sent');
  const latestSubmittedEvent = [...auditTrail]
    .reverse()
    .find((event) => event.event_type === 'payment_submitted');
  const latestConfirmedEvent = [...auditTrail]
    .reverse()
    .find((event) => event.event_type === 'payment_received');

  const checkoutMetadata = parseAuditMetadata(latestCheckoutEvent?.metadata);
  const submittedMetadata = parseAuditMetadata(latestSubmittedEvent?.metadata);
  const confirmedMetadata = parseAuditMetadata(latestConfirmedEvent?.metadata);

  return {
    paymentReference,
    checkoutUrl:
      checkoutMetadata?.checkout_url &&
      typeof checkoutMetadata.checkout_url === 'string'
        ? checkoutMetadata.checkout_url
        : null,
    transactionReference:
      checkoutMetadata?.transaction_reference &&
      typeof checkoutMetadata.transaction_reference === 'string'
        ? checkoutMetadata.transaction_reference
        : null,
    submittedAt: latestSubmittedEvent?.created_at || null,
    submittedTransactionId:
      submittedMetadata?.transaction_id &&
      typeof submittedMetadata.transaction_id === 'string'
        ? submittedMetadata.transaction_id
        : null,
    submittedStatus:
      submittedMetadata?.status && typeof submittedMetadata.status === 'string'
        ? submittedMetadata.status
        : null,
    confirmedAt: latestConfirmedEvent?.created_at || null,
    confirmedBy:
      confirmedMetadata?.confirmed_by &&
      typeof confirmedMetadata.confirmed_by === 'string'
        ? confirmedMetadata.confirmed_by
        : null,
  };
}

export async function triggerPaymentInstructions(
  lead: Lead,
  options: {
    appBaseUrl?: string;
  } = {}
): Promise<PaymentInstructionResult> {
  const paymentReference = getPaymentReference(lead.id);
  const commitmentSelection = await getLeadCommitmentSelection(lead.id);
  const commitmentLabel = commitmentSelection.commitmentLabel;
  const appBaseUrl = normalizeAppBaseUrl(options.appBaseUrl);

  const checkoutSession = await createFlutterwaveCheckoutSession({
    leadId: lead.id,
    leadEmail: lead.email,
    investorName: lead.full_name || 'Investor',
    phoneNumber: lead.phone,
    amount: commitmentSelection.commitmentAmountNgn,
    currency: 'NGN',
    paymentReference,
    slotCount: commitmentSelection.slotCount,
    commitmentLabel,
    appBaseUrl,
  });

  await logAuditEvent({
    leadId: lead.id,
    eventType: 'payment_instructions_sent',
    metadata: {
      payment_reference: paymentReference,
      commitment_label: commitmentLabel,
      commitment_amount_ngn: commitmentSelection.commitmentAmountNgn,
      slot_count: commitmentSelection.slotCount,
      transaction_reference: checkoutSession.transactionReference,
      checkout_url: checkoutSession.checkoutUrl,
      checkout_currency: 'NGN',
      provider: 'flutterwave',
    },
  });

  let warning: string | undefined;

  try {
    const emailTemplate = getPaymentInstructionsEmailTemplate({
      investorName: lead.full_name || 'Investor',
      paymentReference,
      commitmentLabel,
      checkoutUrl: checkoutSession.checkoutUrl,
    });

    await sendEmail({
      to: lead.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });
  } catch (emailError) {
    warning =
      emailError instanceof Error
        ? emailError.message
        : 'Flutterwave checkout was created, but the email could not be sent.';
  }

  return {
    paymentReference,
    commitmentLabel,
    checkoutUrl: checkoutSession.checkoutUrl,
    transactionReference: checkoutSession.transactionReference,
    warning,
  };
}

export async function processFlutterwavePaymentCallback(params: {
  leadId: string;
  transactionId: string;
  transactionReference?: string;
}): Promise<FlutterwavePaymentCallbackResult> {
  const lead = await getLeadById(params.leadId);

  if (!lead) {
    throw new Error('Lead not found for Flutterwave callback');
  }

  const commitmentSelection = await getLeadCommitmentSelection(lead.id);
  const paymentReference = getPaymentReference(lead.id);
  const verifiedPayment = await verifyFlutterwaveTransaction(params.transactionId);

  if (
    params.transactionReference &&
    verifiedPayment.transactionReference &&
    params.transactionReference !== verifiedPayment.transactionReference
  ) {
    return {
      lead,
      paymentReference,
      commitmentLabel: commitmentSelection.commitmentLabel,
      amount: verifiedPayment.amount,
      currency: verifiedPayment.currency,
      status: 'invalid',
      transactionReference: verifiedPayment.transactionReference,
      transactionId: verifiedPayment.transactionId,
    };
  }

  const amountMatches =
    Math.abs(verifiedPayment.amount - commitmentSelection.commitmentAmountNgn) < 0.01;
  const currencyMatches = verifiedPayment.currency.toUpperCase() === 'NGN';

  if (!amountMatches || !currencyMatches) {
    return {
      lead,
      paymentReference,
      commitmentLabel: commitmentSelection.commitmentLabel,
      amount: verifiedPayment.amount,
      currency: verifiedPayment.currency,
      status: 'invalid',
      transactionReference: verifiedPayment.transactionReference,
      transactionId: verifiedPayment.transactionId,
    };
  }

  const normalizedStatus = verifiedPayment.status.toLowerCase();

  if (normalizedStatus === 'successful' || normalizedStatus === 'succeeded') {
    const progress = await getLeadPaymentProgress(lead.id);

    if (progress.submittedTransactionId !== verifiedPayment.transactionId) {
      await logAuditEvent({
        leadId: lead.id,
        eventType: 'payment_submitted',
        metadata: {
          payment_reference: paymentReference,
          transaction_reference: verifiedPayment.transactionReference,
          transaction_id: verifiedPayment.transactionId,
          amount: verifiedPayment.amount,
          currency: verifiedPayment.currency,
          status: verifiedPayment.status,
          provider: 'flutterwave',
        },
      });

      await saveMessage({
        leadId: lead.id,
        role: 'agent',
        content:
          'We have received your Flutterwave payment confirmation. FutureX is now validating settlement and will confirm your allocation shortly.',
      });
    }

    return {
      lead,
      paymentReference,
      commitmentLabel: commitmentSelection.commitmentLabel,
      amount: verifiedPayment.amount,
      currency: verifiedPayment.currency,
      status: 'submitted',
      transactionReference: verifiedPayment.transactionReference,
      transactionId: verifiedPayment.transactionId,
    };
  }

  if (normalizedStatus === 'pending') {
    return {
      lead,
      paymentReference,
      commitmentLabel: commitmentSelection.commitmentLabel,
      amount: verifiedPayment.amount,
      currency: verifiedPayment.currency,
      status: 'pending',
      transactionReference: verifiedPayment.transactionReference,
      transactionId: verifiedPayment.transactionId,
    };
  }

  return {
    lead,
    paymentReference,
    commitmentLabel: commitmentSelection.commitmentLabel,
    amount: verifiedPayment.amount,
    currency: verifiedPayment.currency,
    status: 'failed',
    transactionReference: verifiedPayment.transactionReference,
    transactionId: verifiedPayment.transactionId,
  };
}
