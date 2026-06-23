import { MINIMUM_TICKET_NGN, parseMoneyValue } from '@/lib/agent/qualification';
import { SPV_CODE } from '@/lib/agreement/template';
import { logAuditEvent } from '@/lib/db/audit';
import type { Lead } from '@/lib/db/leads';
import { updateLeadStage } from '@/lib/db/leads';
import { getLatestQualificationAnswerMap } from '@/lib/db/qualification';
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

function formatNairaAmount(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}

export async function resolveCommitmentLabel(
  leadId: string
): Promise<string> {
  const latestAnswers = await getLatestQualificationAnswerMap(leadId);
  const ticketAnswer = latestAnswers.ticket_size?.answer;

  if (!ticketAnswer) {
    return formatNairaAmount(MINIMUM_TICKET_NGN);
  }

  const parsedAmount = parseMoneyValue(ticketAnswer);
  if (!parsedAmount) {
    return formatNairaAmount(MINIMUM_TICKET_NGN);
  }

  if (parsedAmount.currency === 'NGN') {
    return formatNairaAmount(parsedAmount.amount);
  }

  return `USD $${parsedAmount.amount.toLocaleString('en-US')} equivalent`;
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
  const commitmentLabel = await resolveCommitmentLabel(lead.id);
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
      deadline: deadlineLabel,
    },
  });

  await updateLeadStage(lead.id, 'payment_pending');

  return {
    paymentReference,
    commitmentLabel,
    deadlineLabel,
  };
}
