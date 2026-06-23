import { NextRequest, NextResponse } from 'next/server';
import { toChatMessages } from '@/lib/chat/messages';
import { getLeadById } from '@/lib/db/leads';
import { getMessagesByLeadId } from '@/lib/db/messages';
import {
  getLatestQualificationAnswerMap,
} from '@/lib/db/qualification';
import {
  getNextQualificationQuestion,
  type QualificationQuestion,
} from '@/lib/agent/qualification';
import { orchestrator } from '@/lib/agent/orchestrator';
import { sendEmail } from '@/lib/email/resend-client';
import { getDealRoomAccessEmailTemplate } from '@/lib/email/templates';
import { logAuditEvent } from '@/lib/db/audit';

const BINARY_QUALIFICATION_QUESTIONS = new Set<QualificationQuestion>([
  'investment_horizon',
  'ticket_size',
  'kyc_willingness',
]);

async function getQualificationState(
  leadId: string,
  stage: string
): Promise<{
  currentQuestion: QualificationQuestion | null;
  expectsBinaryResponse: boolean;
}> {
  if (stage !== 'outreach_sent' && stage !== 'qualifying') {
    return {
      currentQuestion: null,
      expectsBinaryResponse: false,
    };
  }

  const latestAnswers = await getLatestQualificationAnswerMap(leadId);
  const currentQuestion = getNextQualificationQuestion(
    Object.keys(latestAnswers)
  );

  return {
    currentQuestion,
    expectsBinaryResponse:
      currentQuestion !== null &&
      BINARY_QUALIFICATION_QUESTIONS.has(currentQuestion),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;

    const lead = await getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const messages = await getMessagesByLeadId(leadId);
    const qualificationState = await getQualificationState(leadId, lead.stage);

    return NextResponse.json({
      lead,
      messages: toChatMessages(messages),
      qualificationState,
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;
    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const lead = await getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Process message through agent orchestrator
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
      new URL(request.url).origin;

    const response = await orchestrator.processMessage(lead, message, {
      appUrl,
    });

    // Stage is persisted by the orchestrator or explicit admin routes only.
    const updatedLead = (await getLeadById(leadId)) || lead;
    const nextStage = updatedLead.stage;
    const qualificationState = await getQualificationState(leadId, nextStage);

    if (updatedLead.stage === 'deal_room' && lead.stage !== 'deal_room') {
      const chatLink = `${appUrl}/chat/${lead.id}`;
      const emailTemplate = getDealRoomAccessEmailTemplate({
        investorName: lead.full_name || 'there',
        chatLink,
      });

      try {
        await sendEmail({
          to: lead.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
        });

        await logAuditEvent({
          leadId,
          eventType: 'deal_room_email_sent',
          metadata: {
            to: lead.email,
          },
        });
      } catch (emailError) {
        console.error('Failed to send deal room access email:', emailError);
      }
    }

    return NextResponse.json({
      messages: toChatMessages(response.agentMessages),
      stage: nextStage,
      qualificationState,
    });
  } catch (error) {
    console.error('Error processing message:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}
