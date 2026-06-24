import { SPV_CODE } from '@/lib/agreement/template';
import {
  AGREEMENT_COMMITMENT_AMOUNT_NGN_QUESTION,
  AGREEMENT_SLOT_COUNT_QUESTION,
  buildCommitmentSelection,
  DEFAULT_COMMITMENT_SLOT_COUNT,
  type CommitmentSelection,
} from '@/lib/agreement/commitment';
import { logAuditEvent } from '@/lib/db/audit';
import type { Lead } from '@/lib/db/leads';
import {
  getLatestQualificationAnswerMap,
  saveQualificationAnswer,
} from '@/lib/db/qualification';
import { sendEmail } from '@/lib/email/resend-client';
import { getPaymentInstructionsEmailTemplate } from '@/lib/email/templates';
import {
  PAYMENT_DETAILS,
  type SerializablePaymentDetails,
} from '@/lib/payment-details';

export interface PaymentInstructionResult {
  paymentReference: string;
  commitmentLabel: string;
  commitmentAmountNgn: number;
  slotCount: number;
  paymentDetails: SerializablePaymentDetails;
  warning?: string;
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

export async function sendPaymentInstructions(
  lead: Lead
): Promise<PaymentInstructionResult> {
  const paymentReference = getPaymentReference(lead.id);
  const commitmentSelection = await getLeadCommitmentSelection(lead.id);

  await logAuditEvent({
    leadId: lead.id,
    eventType: 'payment_instructions_sent',
    metadata: {
      payment_reference: paymentReference,
      commitment_label: commitmentSelection.commitmentLabel,
      commitment_amount_ngn: commitmentSelection.commitmentAmountNgn,
      slot_count: commitmentSelection.slotCount,
      provider: 'manual_wire',
    },
  });

  let warning: string | undefined;

  try {
    const emailTemplate = getPaymentInstructionsEmailTemplate({
      investorName: lead.full_name || 'Investor',
      paymentReference,
      commitmentLabel: commitmentSelection.commitmentLabel,
      commitmentAmountNgn: commitmentSelection.commitmentAmountNgn,
      slotCount: commitmentSelection.slotCount,
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
        : 'Payment instructions could not be emailed automatically.';
  }

  return {
    paymentReference,
    commitmentLabel: commitmentSelection.commitmentLabel,
    commitmentAmountNgn: commitmentSelection.commitmentAmountNgn,
    slotCount: commitmentSelection.slotCount,
    paymentDetails: PAYMENT_DETAILS,
    warning,
  };
}
