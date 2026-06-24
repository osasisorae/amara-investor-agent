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

export interface PaymentInstructionResult {
  paymentReference: string;
  commitmentLabel: string;
  deadlineLabel: string;
}

function addBusinessDays(baseDate: Date, businessDays: number): Date {
  const result = new Date(baseDate);
  let remaining = businessDays;

  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();

    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }

  return result;
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

export async function triggerPaymentInstructions(
  lead: Lead
): Promise<PaymentInstructionResult> {
  const bankDetails = process.env.PAYMENT_BANK_DETAILS?.trim();

  if (!bankDetails) {
    throw new Error(
      'PAYMENT_BANK_DETAILS environment variable is required to send payment instructions'
    );
  }

  const paymentReference = getPaymentReference(lead.id);
  const commitmentSelection = await getLeadCommitmentSelection(lead.id);
  const commitmentLabel = commitmentSelection.commitmentLabel;
  const deadline = addBusinessDays(new Date(), 5);
  const deadlineLabel = deadline.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const emailTemplate = getPaymentInstructionsEmailTemplate({
    investorName: lead.full_name || 'Investor',
    paymentReference,
    bankDetails,
    commitmentLabel,
    deadlineLabel,
  });

  await sendEmail({
    to: lead.email,
    subject: emailTemplate.subject,
    html: emailTemplate.html,
    text: emailTemplate.text,
  });

  await logAuditEvent({
    leadId: lead.id,
    eventType: 'payment_instructions_sent',
    metadata: {
      payment_reference: paymentReference,
      commitment_label: commitmentLabel,
      commitment_amount_ngn: commitmentSelection.commitmentAmountNgn,
      slot_count: commitmentSelection.slotCount,
      deadline: deadlineLabel,
    },
  });

  return {
    paymentReference,
    commitmentLabel,
    deadlineLabel,
  };
}
