import { SPV_CODE } from '@/lib/agreement/template';
import { queryOne } from '@/lib/db/client';
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
import { type PaymentMethod, isPaymentMethod } from '@/lib/payment-methods';

export interface PaymentInstructionResult {
  paymentReference: string;
  commitmentLabel: string;
  commitmentAmountNgn: number;
  slotCount: number;
  warning?: string;
}

interface PaymentConfirmationAuditRow {
  metadata?: string | null;
  created_at: number;
}

export interface PaymentConfirmationStatus {
  confirmed: boolean;
  method?: PaymentMethod;
  reference?: string;
  createdAt?: number;
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

function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
}

function parsePaymentConfirmationMetadata(
  value?: string | null
): PaymentConfirmationStatus {
  if (!value) {
    return { confirmed: false };
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { confirmed: false };
    }

    const method = 'method' in parsed ? parsed.method : undefined;
    const reference = 'reference' in parsed ? parsed.reference : undefined;

    return {
      confirmed: isPaymentMethod(method) ? true : false,
      method: isPaymentMethod(method) ? method : undefined,
      reference: typeof reference === 'string' ? reference : undefined,
    };
  } catch {
    return { confirmed: false };
  }
}

export async function getPaymentConfirmationStatus(
  leadId: string
): Promise<PaymentConfirmationStatus> {
  const row = await queryOne<PaymentConfirmationAuditRow>(
    `SELECT metadata, created_at
     FROM audit_events
     WHERE lead_id = ?
       AND event_type = 'payment_confirmation_sent'
     ORDER BY created_at DESC
     LIMIT 1`,
    [leadId]
  );

  if (!row) {
    return { confirmed: false };
  }

  const parsed = parsePaymentConfirmationMetadata(row.metadata);

  return {
    ...parsed,
    confirmed: parsed.confirmed,
    createdAt: row.created_at,
  };
}

export async function sendPaymentInstructions(
  lead: Lead
): Promise<PaymentInstructionResult> {
  const paymentReference = getPaymentReference(lead.id);
  const commitmentSelection = await getLeadCommitmentSelection(lead.id);
  const chatUrl = `${getAppBaseUrl()}/chat/${lead.id}`;

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
      chatUrl,
      paymentReference,
      commitmentLabel: commitmentSelection.commitmentLabel,
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
    warning,
  };
}
