import { NextRequest, NextResponse } from 'next/server';
import { getAllLeads } from '@/lib/db/leads';
import { query, execute, queryOne } from '@/lib/db/client';
import {
  buildFutureInterestNote,
  detectFutureInterestRequest,
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

function parseMetadata(value?: string | null): Record<string, any> | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function inferHistoricalSummary(messages: MessageRow[]) {
  let location: string | null = null;
  let disqualificationReason: string | null = null;
  let futureInterestNote: string | null = null;

  for (const message of messages) {
    if (message.role === 'investor' && !location) {
      const match = message.content.match(
        /\b(?:based in|live in|located in|resident in|from)\s+([a-z ,'-]{2,40})/i
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

      if (
        lower.includes('minimum investment horizon of 3 years') ||
        lower.includes("isn't the right fit for your current goals")
      ) {
        disqualificationReason =
          'Not comfortable with the minimum 3-year investment horizon.';
      } else if (
        lower.includes('minimum ticket size') ||
        lower.includes('ngn 5m') ||
        lower.includes('₦5m')
      ) {
        disqualificationReason =
          'Below the minimum ticket size of NGN 5M (or USD equivalent).';
      } else if (lower.includes('not willing to proceed through kyc')) {
        disqualificationReason = 'Not willing to complete KYC compliance.';
      } else if (
        lower.includes('not the right fit') ||
        lower.includes('not eligible') ||
        lower.includes('cannot proceed')
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
          disqualificationReason?.includes('3-year')
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

export async function GET() {
  try {
    const leads = await getAllLeads();
    const qualificationAnswers = await query<QualificationAnswerRow>(
      `SELECT lead_id, question, answer, passed, created_at
       FROM qualification_answers
       ORDER BY created_at DESC`
    );
    const auditEvents = await query<AuditEventRow>(
      `SELECT lead_id, event_type, metadata, created_at
       FROM audit_events
       WHERE event_type IN ('qualification_failed', 'future_interest_noted')
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
      const failedMetadata = parseMetadata(failedEvent?.metadata);
      const futureInterestMetadata = parseMetadata(futureInterestEvent?.metadata);
      const historicalSummary = inferHistoricalSummary(
        messagesByLead.get(lead.id) || []
      );
      const effectiveStage =
        lead.stage === 'disqualified' || failedMetadata?.reason || historicalSummary.disqualificationReason
          ? 'disqualified'
          : lead.stage;

      return {
        ...lead,
        stage: effectiveStage,
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
          disqualificationReason:
            failedMetadata?.reason || historicalSummary.disqualificationReason || null,
          futureInterestNote:
            futureInterestMetadata?.note || historicalSummary.futureInterestNote || null,
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
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');

    if (!leadId) {
      return NextResponse.json(
        { error: 'leadId query parameter required' },
        { status: 400 }
      );
    }

    // Get lead email first
    const lead = await queryOne<{ email: string }>(
      'SELECT email FROM leads WHERE id = ?',
      [leadId]
    );

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Delete from all related tables
    await execute('DELETE FROM messages WHERE lead_id = ?', [leadId]);
    await execute('DELETE FROM qualification_answers WHERE lead_id = ?', [leadId]);
    await execute('DELETE FROM kyc_documents WHERE lead_id = ?', [leadId]);
    await execute('DELETE FROM audit_events WHERE lead_id = ?', [leadId]);
    await execute('DELETE FROM otp_codes WHERE lead_id = ?', [leadId]);
    await execute('DELETE FROM leads WHERE id = ?', [leadId]);
    
    // Also delete from offeree register to allow re-adding
    await execute('DELETE FROM offeree_register WHERE email = ?', [lead.email]);

    return NextResponse.json({
      success: true,
      message: 'Lead and all associated data deleted',
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
