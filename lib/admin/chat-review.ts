import {
  getDisqualificationReason,
  getNextQualificationQuestion,
  QUALIFICATION_SEQUENCE,
  summarizeQualificationAnswer,
  type QualificationQuestion,
} from '@/lib/agent/qualification';
import {
  getComponentFallbackText,
  parseUIComponentMetadata,
} from '@/lib/chat/components';
import type { AuditEvent } from '@/lib/db/audit';
import type { Lead, LeadStage } from '@/lib/db/leads';
import type { Message } from '@/lib/db/messages';
import type { QualificationAnswer } from '@/lib/db/qualification';

export interface AdminReviewMessage {
  id: string;
  role: 'agent' | 'investor';
  content: string;
  createdAt: number;
  senderType: 'investor' | 'amara' | 'futurex_team';
  senderLabel: 'Investor' | 'Amara' | 'FutureX Team';
}

export interface AdminChatSummary {
  headline: string;
  stageLabel: string;
  currentLocation: string | null;
  stageEnteredAt: number | null;
  timeInStageLabel: string;
  whyThisStage: string;
  suggestedNextStep: string;
  qualificationSignals: string[];
  latestInvestorMessagePreview: string | null;
  latestInvestorMessageAt: number | null;
}

function parseMetadata(
  value?: string | null
): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function trimFuturexTeamPrefix(value: string): string {
  return value.replace(/^FutureX team:\s*/i, '');
}

function truncateText(value: string, maxLength = 220): string {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function formatLeadStageLabel(stage: LeadStage): string {
  if (stage === 'disqualified') {
    return 'not a fit';
  }

  return stage.replace(/_/g, ' ');
}

function humanizeDuration(seconds: number): string {
  if (seconds < 60) {
    return 'less than a minute';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }

  const days = Math.floor(hours / 24);
  if (days < 14) {
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 8) {
    return `${weeks} week${weeks === 1 ? '' : 's'}`;
  }

  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'}`;
}

function getQualificationQuestionLabel(question: QualificationQuestion): string {
  switch (question) {
    case 'investor_profile':
      return 'their investor profile and location';
    case 'ticket_size':
      return 'their ticket size';
    case 'investment_horizon':
      return 'their investment horizon';
    case 'kyc_willingness':
      return 'their willingness to complete KYC';
  }
}

function extractLocationFromMessages(messages: Message[]): string | null {
  for (const message of messages) {
    if (message.role !== 'investor') {
      continue;
    }

    const match = message.content.match(
      /\b(?:based in|live in|located in|resident in|from|i(?:'m| am)? in)\s+([a-z ,'-]{2,40})/i
    );

    if (!match) {
      continue;
    }

    const cleaned = match[1]
      .split(/[.!?]/)[0]
      .replace(/\b(and|but|so)\b.*$/i, '')
      .trim();

    if (cleaned) {
      return cleaned;
    }
  }

  return null;
}

function extractLocationFromQualificationSummary(
  summary: string | null
): string | null {
  if (!summary) {
    return null;
  }

  const match = summary.match(/\bbased in\s+([^.]*)/i);

  if (!match?.[1]?.trim()) {
    return null;
  }

  return match[1].trim();
}

function resolveCurrentLocation(params: {
  lead: Lead;
  qualificationSignals: string[];
  messages: Message[];
}): string | null {
  if (params.lead.country?.trim()) {
    return params.lead.country.trim();
  }

  const profileSignal = params.qualificationSignals.find((signal) =>
    signal.toLowerCase().includes('based in ')
  );
  const locationFromSignal = extractLocationFromQualificationSummary(
    profileSignal || null
  );

  if (locationFromSignal) {
    return locationFromSignal;
  }

  return extractLocationFromMessages(params.messages);
}

function findLatestAuditEvent(
  events: AuditEvent[],
  eventTypes: AuditEvent['event_type'][]
): AuditEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];

    if (eventTypes.includes(event.event_type)) {
      return event;
    }
  }

  return null;
}

function findLatestInvestorMessage(messages: Message[]): Message | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role === 'investor' && message.content.trim()) {
      return message;
    }
  }

  return null;
}

function getDisqualificationReasonFromState(
  latestAnswers: Record<string, QualificationAnswer>,
  auditEvents: AuditEvent[]
): string | null {
  const failedEvent = findLatestAuditEvent(auditEvents, ['qualification_failed']);
  const failedMetadata = parseMetadata(failedEvent?.metadata);

  if (
    typeof failedMetadata?.reason === 'string' &&
    failedMetadata.reason.trim().length > 0
  ) {
    return failedMetadata.reason.trim();
  }

  const failedQuestion = QUALIFICATION_SEQUENCE.find(
    (question) => latestAnswers[question]?.passed === 0
  );

  return failedQuestion ? getDisqualificationReason(failedQuestion) : null;
}

function getKycRejectionReason(auditEvents: AuditEvent[]): string | null {
  const rejectedEvent = findLatestAuditEvent(auditEvents, ['kyc_rejected']);
  const rejectedMetadata = parseMetadata(rejectedEvent?.metadata);

  if (
    typeof rejectedMetadata?.reason === 'string' &&
    rejectedMetadata.reason.trim().length > 0
  ) {
    return rejectedMetadata.reason.trim();
  }

  return null;
}

function getStageEnteredAt(params: {
  lead: Lead;
  auditEvents: AuditEvent[];
  messages: Message[];
}): number | null {
  const { lead, auditEvents, messages } = params;

  switch (lead.stage) {
    case 'outreach_sent':
      return lead.added_at || lead.created_at;
    case 'qualifying':
      return (
        findLatestAuditEvent(auditEvents, ['qualification_started'])?.created_at ||
        messages[0]?.created_at ||
        lead.updated_at ||
        lead.added_at
      );
    case 'deal_room':
      return (
        lead.qualified_at ||
        findLatestAuditEvent(auditEvents, ['qualification_passed'])?.created_at ||
        lead.updated_at
      );
    case 'kyc_intake':
      return (
        findLatestAuditEvent(auditEvents, ['deal_room_accessed'])?.created_at ||
        lead.updated_at
      );
    case 'pending_human_review':
      return (
        findLatestAuditEvent(auditEvents, [
          'human_review_requested',
          'kyc_submitted',
        ])?.created_at ||
        lead.kyc_submitted_at ||
        lead.updated_at
      );
    case 'kyc_rejected':
      return (
        findLatestAuditEvent(auditEvents, ['kyc_rejected'])?.created_at ||
        lead.kyc_reviewed_at ||
        lead.updated_at
      );
    case 'agreement_pending':
      return (
        findLatestAuditEvent(auditEvents, ['kyc_approved'])?.created_at ||
        lead.kyc_reviewed_at ||
        lead.updated_at
      );
    case 'agreement_signed':
      return (
        findLatestAuditEvent(auditEvents, ['agreement_signed'])?.created_at ||
        lead.agreement_signed_at ||
        lead.updated_at
      );
    case 'payment_pending':
      return (
        findLatestAuditEvent(auditEvents, [
          'payment_instructions_sent',
          'agreement_signed',
        ])?.created_at ||
        lead.agreement_signed_at ||
        lead.updated_at
      );
    case 'closed':
      return (
        findLatestAuditEvent(auditEvents, ['payment_received'])?.created_at ||
        lead.updated_at
      );
    case 'disqualified':
      return (
        findLatestAuditEvent(auditEvents, ['qualification_failed'])?.created_at ||
        lead.updated_at
      );
  }
}

function buildWhyThisStage(params: {
  lead: Lead;
  latestAnswers: Record<string, QualificationAnswer>;
  reviewReason: string | null;
  disqualificationReason: string | null;
  kycRejectionReason: string | null;
}): string {
  const {
    lead,
    latestAnswers,
    reviewReason,
    disqualificationReason,
    kycRejectionReason,
  } = params;
  const nextQuestion = getNextQualificationQuestion(Object.keys(latestAnswers));

  switch (lead.stage) {
    case 'outreach_sent':
      return 'Outreach has been sent, but the investor has not yet started the guided qualification flow.';
    case 'qualifying':
      return nextQuestion
        ? `The investor is still qualifying. Amara is waiting for a clear answer on ${getQualificationQuestionLabel(
            nextQuestion
          )}.`
        : 'The investor is still in the qualification flow and the recorded answers are not complete yet.';
    case 'deal_room':
      return 'The investor passed qualification and is reviewing deal-room materials before choosing whether to proceed to KYC.';
    case 'kyc_intake':
      return 'The investor chose to move forward and is currently part-way through KYC intake and document submission.';
    case 'pending_human_review':
      return reviewReason
        ? `Amara escalated this lead for manual review: ${reviewReason}`
        : 'KYC has been submitted and the lead is waiting for human review before the flow can continue.';
    case 'kyc_rejected':
      return kycRejectionReason
        ? `The lead was sent back for corrections: ${kycRejectionReason}`
        : 'The latest KYC review rejected or returned the submission for corrections.';
    case 'agreement_pending':
      return 'KYC is approved, so the investor can now review and sign the agreement.';
    case 'agreement_signed':
      return 'The agreement has been signed, but the payment handoff has not fully advanced yet.';
    case 'payment_pending':
      return 'The investor has signed and received payment instructions. The record stays here until funds are confirmed manually.';
    case 'closed':
      return 'Payment has been confirmed and the investor record is now closed.';
    case 'disqualified':
      return disqualificationReason
        ? `The lead did not meet the qualification bar: ${disqualificationReason}`
        : 'The lead did not meet one or more qualification criteria.';
  }
}

function buildSuggestedNextStep(params: {
  lead: Lead;
  latestAnswers: Record<string, QualificationAnswer>;
  reviewOpen: boolean;
  reviewReason: string | null;
}): string {
  const { lead, latestAnswers, reviewOpen, reviewReason } = params;
  const nextQuestion = getNextQualificationQuestion(Object.keys(latestAnswers));

  if (reviewOpen) {
    return reviewReason
      ? `Review the flagged issue, verify the transcript, and respond as FutureX Team if the investor needs a direct answer.`
      : 'Review the transcript, verify why Amara escalated the lead, and resolve the open admin follow-up.';
  }

  switch (lead.stage) {
    case 'outreach_sent':
      return 'Wait for the investor to request access, or send a manual nudge if the lead has gone stale.';
    case 'qualifying':
      return nextQuestion
        ? `Let Amara finish qualification, with focus on ${getQualificationQuestionLabel(
            nextQuestion
          )}. If the lead stalls, send a manual follow-up.`
        : 'Let Amara finish the remaining qualification questions or manually nudge the investor if the conversation is stalled.';
    case 'deal_room':
      return 'Let the investor keep reviewing the deal room, or guide them into KYC once they clearly want to proceed.';
    case 'kyc_intake':
      return 'Wait for the remaining KYC fields and uploads, then review the submission once Amara escalates it.';
    case 'pending_human_review':
      return 'Complete manual KYC or follow-up review, then either resolve the request or move the lead forward.';
    case 'kyc_rejected':
      return 'Wait for the investor to correct and resubmit the missing or rejected KYC items.';
    case 'agreement_pending':
      return 'Prompt the investor to request an OTP and sign the agreement.';
    case 'agreement_signed':
      return 'Make sure payment instructions reached the investor and confirm the handoff into payment follow-through.';
    case 'payment_pending':
      return 'Match the inbound transfer to the payment reference and confirm receipt once funds land.';
    case 'closed':
      return 'No immediate operational action is required unless the team wants post-close follow-up.';
    case 'disqualified':
      return 'No immediate action is required unless the team wants a manual re-engagement or future-interest follow-up.';
  }
}

function buildHeadline(stage: LeadStage, currentLocation: string | null): string {
  const locationPrefix = currentLocation ? `${currentLocation}-based ` : '';

  switch (stage) {
    case 'outreach_sent':
      return `${locationPrefix}lead is awaiting first qualification activity.`;
    case 'qualifying':
      return `${locationPrefix}investor is still moving through qualification.`;
    case 'deal_room':
      return `${locationPrefix}investor has qualified and is reviewing the opportunity.`;
    case 'kyc_intake':
      return `${locationPrefix}investor is working through KYC intake.`;
    case 'pending_human_review':
      return `${locationPrefix}investor is waiting on manual review.`;
    case 'kyc_rejected':
      return `${locationPrefix}investor has been sent back for KYC corrections.`;
    case 'agreement_pending':
      return `${locationPrefix}investor is ready for agreement review and signing.`;
    case 'agreement_signed':
      return `${locationPrefix}investor has signed the agreement.`;
    case 'payment_pending':
      return `${locationPrefix}investor is awaiting payment confirmation.`;
    case 'closed':
      return `${locationPrefix}investor has completed the workflow.`;
    case 'disqualified':
      return `${locationPrefix}lead does not currently fit the mandate.`;
  }
}

export function mapAdminReviewMessage(message: Message): AdminReviewMessage {
  const metadata = parseMetadata(message.metadata);
  const isFuturexTeamMessage =
    message.role === 'agent' &&
    (metadata?.senderType === 'futurex_team' ||
      /^FutureX team:\s*/i.test(message.content));
  const componentMetadata = parseUIComponentMetadata(message.metadata);
  const fallbackContent = componentMetadata
    ? getComponentFallbackText(componentMetadata.component)
    : '';
  const normalizedContent = message.content.trim()
    ? isFuturexTeamMessage
      ? trimFuturexTeamPrefix(message.content)
      : message.content
    : fallbackContent;

  return {
    id: message.id,
    role: message.role,
    content: normalizedContent,
    createdAt: message.created_at,
    senderType:
      message.role === 'investor'
        ? 'investor'
        : isFuturexTeamMessage
          ? 'futurex_team'
          : 'amara',
    senderLabel:
      message.role === 'investor'
        ? 'Investor'
        : isFuturexTeamMessage
          ? 'FutureX Team'
          : 'Amara',
  };
}

export function buildAdminChatSummary(params: {
  lead: Lead;
  latestAnswers: Record<string, QualificationAnswer>;
  auditEvents: AuditEvent[];
  messages: Message[];
  reviewOpen: boolean;
  reviewReason: string | null;
}): AdminChatSummary {
  const qualificationSignals = QUALIFICATION_SEQUENCE.map((question) => {
    const answer = params.latestAnswers[question];

    if (!answer) {
      return null;
    }

    return summarizeQualificationAnswer(
      answer.question,
      answer.answer,
      answer.passed
    );
  }).filter((value): value is string => Boolean(value));
  const currentLocation = resolveCurrentLocation({
    lead: params.lead,
    qualificationSignals,
    messages: params.messages,
  });
  const latestInvestorMessage = findLatestInvestorMessage(params.messages);
  const disqualificationReason = getDisqualificationReasonFromState(
    params.latestAnswers,
    params.auditEvents
  );
  const kycRejectionReason = getKycRejectionReason(params.auditEvents);
  const stageEnteredAt = getStageEnteredAt({
    lead: params.lead,
    auditEvents: params.auditEvents,
    messages: params.messages,
  });
  const now = Math.floor(Date.now() / 1000);

  return {
    headline: buildHeadline(params.lead.stage, currentLocation),
    stageLabel: formatLeadStageLabel(params.lead.stage),
    currentLocation,
    stageEnteredAt,
    timeInStageLabel:
      stageEnteredAt && stageEnteredAt <= now
        ? humanizeDuration(now - stageEnteredAt)
        : 'Not available',
    whyThisStage: buildWhyThisStage({
      lead: params.lead,
      latestAnswers: params.latestAnswers,
      reviewReason: params.reviewReason,
      disqualificationReason,
      kycRejectionReason,
    }),
    suggestedNextStep: buildSuggestedNextStep({
      lead: params.lead,
      latestAnswers: params.latestAnswers,
      reviewOpen: params.reviewOpen,
      reviewReason: params.reviewReason,
    }),
    qualificationSignals,
    latestInvestorMessagePreview: latestInvestorMessage
      ? truncateText(latestInvestorMessage.content)
      : null,
    latestInvestorMessageAt: latestInvestorMessage?.created_at || null,
  };
}
