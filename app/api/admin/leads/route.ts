import { NextRequest, NextResponse } from 'next/server';
import { deleteLeadCascade, getAllLeads } from '@/lib/db/leads';
import { query } from '@/lib/db/client';
import { verifyAdminSession } from '@/lib/admin-auth';
import {
  buildFutureInterestNote,
  detectFutureInterestRequest,
  getDisqualificationReason,
  QUALIFICATION_SEQUENCE,
  summarizeQualificationAnswer,
} from '@/lib/agent/qualification';

interface QualificationAnswerRow {
  lead_id: string;
  question: string;
  answer: string;
  passed: number;
  created_at: number;
}

interface AuditEventRow {
  lead_id: string;
  event_type: string;
  metadata?: string | null;
  created_at: number;
}

interface MessageRow {
  lead_id: string;
  role: 'agent' | 'investor';
  content: string;
  created_at: number;
}

const QUALIFIED_STAGES = new Set([
  'deal_room',
  'kyc_intake',
  'pending_human_review',
  'agreement_pending',
  'agreement_signed',
  'payment_pending',
  'closed',
]);

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

function inferHistoricalSummary(messages: MessageRow[]) {
  let location: string | null = null;
  let disqualificationReason: string | null = null;
  let futureInterestNote: string | null = null;

  for (const message of messages) {
    if (message.role === 'investor' && !location) {
      const match = message.content.match(
        /\b(?:based in|live in|located in|resident in|from|i(?:'m| am)? in)\s+([a-z ,'-]{2,40})/i
      );

      if (match) {
        location = match[1]
          .split(/[.!?]/)[0]
          .replace(/\b(and|but|so)\b.*$/i, '')
          .trim();
      }
    }

    if (message.role === 'agent' && !disqualificationReason) {
      const lower = message.content.toLowerCase();
      const hasFailureCue =
        lower.includes('not the right fit') ||
        lower.includes("isn't the right fit") ||
        lower.includes('not eligible') ||
        lower.includes('cannot proceed') ||
        lower.includes('unfortunately') ||
        lower.includes('does not meet') ||
        lower.includes("doesn't meet") ||
        lower.includes('below the minimum') ||
        lower.includes('not comfortable') ||
        lower.includes('not willing');

      if (
        hasFailureCue &&
        (lower.includes('minimum investment horizon of 5 years') ||
          lower.includes('5-year') ||
          lower.includes('holding period'))
      ) {
        disqualificationReason =
          'Not comfortable with the minimum 5-year investment horizon.';
      } else if (
        hasFailureCue &&
        (lower.includes('minimum ticket size') ||
          lower.includes('ngn 5m') ||
          lower.includes('₦5m'))
      ) {
        disqualificationReason =
          'Below the minimum ticket size of NGN 5M (or USD equivalent).';
      } else if (
        hasFailureCue &&
        (lower.includes('not willing to proceed through kyc') ||
          (lower.includes('kyc') && lower.includes('not willing')))
      ) {
        disqualificationReason = 'Not willing to complete KYC compliance.';
      } else if (
        hasFailureCue &&
        (lower.includes('diaspora') ||
          lower.includes('hni') ||
          lower.includes('eligibility'))
      ) {
        disqualificationReason =
          'Does not meet the diaspora or verified local HNI requirement.';
      } else if (
        hasFailureCue &&
        (lower.includes('not the right fit') ||
          lower.includes('not eligible') ||
          lower.includes('cannot proceed'))
      ) {
        disqualificationReason =
          'This opportunity is not a fit based on the qualification responses.';
      }
    }

    if (!futureInterestNote) {
      const lower = message.content.toLowerCase();

      if (
        (message.role === 'investor' && detectFutureInterestRequest(message.content)) ||
        lower.includes('recorded your interest') ||
        lower.includes('notify you should something aligned become available') ||
        lower.includes('notify you when something aligned becomes available')
      ) {
        futureInterestNote = buildFutureInterestNote(
          message.content,
          disqualificationReason?.includes('5-year')
            ? 'investment_horizon'
            : undefined
        );
      }
    }
  }

  return {
    location,
    disqualificationReason,
    futureInterestNote,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leads = await getAllLeads();
    const qualificationAnswers = await query<QualificationAnswerRow>(
      `SELECT lead_id, question, answer, passed, created_at
       FROM qualification_answers
       ORDER BY created_at DESC`
    );
    const auditEvents = await query<AuditEventRow>(
      `SELECT lead_id, event_type, metadata, created_at
       FROM audit_events
       WHERE event_type IN (
         'qualification_failed',
         'future_interest_noted',
         'human_review_requested',
         'payment_instructions_sent',
         'payment_submitted',
         'payment_received'
       )
       ORDER BY created_at DESC`
    );
    const messages = await query<MessageRow>(
      `SELECT lead_id, role, content, created_at
       FROM messages
       ORDER BY created_at ASC`
    );

    // Get counts by stage
    const stageCounts = await query(`
      SELECT stage, COUNT(*) as count 
      FROM leads 
      GROUP BY stage
    `);

    const answersByLead = new Map<
      string,
      Record<string, QualificationAnswerRow>
    >();

    for (const answer of qualificationAnswers) {
      if (!answersByLead.has(answer.lead_id)) {
        answersByLead.set(answer.lead_id, {});
      }

      const current = answersByLead.get(answer.lead_id)!;
      if (!current[answer.question]) {
        current[answer.question] = answer;
      }
    }

    const latestFailedEventByLead = new Map<string, AuditEventRow>();
    const latestFutureInterestByLead = new Map<string, AuditEventRow>();
    const latestHumanReviewByLead = new Map<string, AuditEventRow>();
    const latestPaymentInstructionsByLead = new Map<string, AuditEventRow>();
    const latestPaymentSubmittedByLead = new Map<string, AuditEventRow>();
    const latestPaymentReceivedByLead = new Map<string, AuditEventRow>();
    const messagesByLead = new Map<string, MessageRow[]>();

    for (const event of auditEvents) {
      if (
        event.event_type === 'qualification_failed' &&
        !latestFailedEventByLead.has(event.lead_id)
      ) {
        latestFailedEventByLead.set(event.lead_id, event);
      }

      if (
        event.event_type === 'future_interest_noted' &&
        !latestFutureInterestByLead.has(event.lead_id)
      ) {
        latestFutureInterestByLead.set(event.lead_id, event);
      }

      if (
        event.event_type === 'human_review_requested' &&
        !latestHumanReviewByLead.has(event.lead_id)
      ) {
        latestHumanReviewByLead.set(event.lead_id, event);
      }

      if (
        event.event_type === 'payment_instructions_sent' &&
        !latestPaymentInstructionsByLead.has(event.lead_id)
      ) {
        latestPaymentInstructionsByLead.set(event.lead_id, event);
      }

      if (
        event.event_type === 'payment_submitted' &&
        !latestPaymentSubmittedByLead.has(event.lead_id)
      ) {
        latestPaymentSubmittedByLead.set(event.lead_id, event);
      }

      if (
        event.event_type === 'payment_received' &&
        !latestPaymentReceivedByLead.has(event.lead_id)
      ) {
        latestPaymentReceivedByLead.set(event.lead_id, event);
      }
    }

    for (const message of messages) {
      if (!messagesByLead.has(message.lead_id)) {
        messagesByLead.set(message.lead_id, []);
      }

      messagesByLead.get(message.lead_id)!.push(message);
    }

    const leadsWithSummary = leads.map((lead) => {
      const latestAnswers = answersByLead.get(lead.id) || {};
      const failedEvent = latestFailedEventByLead.get(lead.id);
      const futureInterestEvent = latestFutureInterestByLead.get(lead.id);
      const humanReviewEvent = latestHumanReviewByLead.get(lead.id);
      const paymentInstructionsEvent = latestPaymentInstructionsByLead.get(lead.id);
      const paymentSubmittedEvent = latestPaymentSubmittedByLead.get(lead.id);
      const paymentReceivedEvent = latestPaymentReceivedByLead.get(lead.id);
      const failedMetadata = parseMetadata(failedEvent?.metadata);
      const futureInterestMetadata = parseMetadata(futureInterestEvent?.metadata);
      const humanReviewMetadata = parseMetadata(humanReviewEvent?.metadata);
      const paymentInstructionsMetadata = parseMetadata(
        paymentInstructionsEvent?.metadata
      );
      const paymentSubmittedMetadata = parseMetadata(
        paymentSubmittedEvent?.metadata
      );
      const paymentReceivedMetadata = parseMetadata(paymentReceivedEvent?.metadata);
      const leadMessages = messagesByLead.get(lead.id) || [];
      const historicalSummary = inferHistoricalSummary(leadMessages);
      const failedQuestion = QUALIFICATION_SEQUENCE.find(
        (question) => latestAnswers[question]?.passed === 0
      );
      const hasPassedAllCriteria = QUALIFICATION_SEQUENCE.every(
        (question) => latestAnswers[question]?.passed === 1
      );
      const isDisqualifiedLead = lead.stage === 'disqualified';
      const isQualifiedLead =
        !isDisqualifiedLead &&
        (hasPassedAllCriteria || QUALIFIED_STAGES.has(lead.stage));
      const resolvedDisqualificationReason = isDisqualifiedLead
        ? failedMetadata?.reason ||
          (failedQuestion ? getDisqualificationReason(failedQuestion) : null) ||
          historicalSummary.disqualificationReason ||
          null
        : isQualifiedLead
          ? null
          : failedMetadata?.reason ||
            (failedQuestion ? getDisqualificationReason(failedQuestion) : null) ||
            historicalSummary.disqualificationReason ||
            null;
      const resolvedFutureInterestNote = isDisqualifiedLead
        ? futureInterestMetadata?.note || historicalSummary.futureInterestNote || null
        : null;

      return {
        ...lead,
        stage: lead.stage,
        country: lead.country || historicalSummary.location || undefined,
        qualificationSummary: {
          investorProfile: latestAnswers.investor_profile
            ? summarizeQualificationAnswer(
                latestAnswers.investor_profile.question,
                latestAnswers.investor_profile.answer,
                latestAnswers.investor_profile.passed
              )
            : null,
          investmentHorizon: latestAnswers.investment_horizon
            ? summarizeQualificationAnswer(
                latestAnswers.investment_horizon.question,
                latestAnswers.investment_horizon.answer,
                latestAnswers.investment_horizon.passed
              )
            : null,
          ticketSize: latestAnswers.ticket_size
            ? summarizeQualificationAnswer(
                latestAnswers.ticket_size.question,
                latestAnswers.ticket_size.answer,
                latestAnswers.ticket_size.passed
              )
            : null,
          kycWillingness: latestAnswers.kyc_willingness
            ? summarizeQualificationAnswer(
                latestAnswers.kyc_willingness.question,
                latestAnswers.kyc_willingness.answer,
                latestAnswers.kyc_willingness.passed
              )
            : null,
          disqualificationReason: resolvedDisqualificationReason,
          futureInterestNote: resolvedFutureInterestNote,
        },
        opsSummary: {
          humanReviewReason:
            humanReviewMetadata?.reason && typeof humanReviewMetadata.reason === 'string'
              ? humanReviewMetadata.reason
              : null,
          paymentReference:
            paymentInstructionsMetadata?.payment_reference &&
            typeof paymentInstructionsMetadata.payment_reference === 'string'
              ? paymentInstructionsMetadata.payment_reference
              : null,
          paymentSubmittedAt: paymentSubmittedEvent?.created_at || null,
          paymentSubmittedStatus:
            paymentSubmittedMetadata?.status &&
            typeof paymentSubmittedMetadata.status === 'string'
              ? paymentSubmittedMetadata.status
              : null,
          paymentTransactionId:
            paymentSubmittedMetadata?.transaction_id &&
            typeof paymentSubmittedMetadata.transaction_id === 'string'
              ? paymentSubmittedMetadata.transaction_id
              : null,
          paymentConfirmedBy:
            paymentReceivedMetadata?.confirmed_by &&
            typeof paymentReceivedMetadata.confirmed_by === 'string'
              ? paymentReceivedMetadata.confirmed_by
              : null,
        },
      };
    });

    return NextResponse.json({
      leads: leadsWithSummary,
      stageCounts,
      total: leads.length,
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');

    if (!leadId) {
      return NextResponse.json(
        { error: 'leadId query parameter required' },
        { status: 400 }
      );
    }

    const lead = await deleteLeadCascade(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Lead and all associated data deleted. Offeree reset for re-add.',
      email: lead.email,
    });
  } catch (error) {
    console.error('Error deleting lead:', error);
    return NextResponse.json(
      { error: 'Failed to delete lead' },
      { status: 500 }
    );
  }
}
