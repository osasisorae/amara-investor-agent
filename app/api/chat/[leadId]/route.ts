import { NextRequest, NextResponse } from 'next/server';
import { toChatMessages } from '@/lib/chat/messages';
import { getLeadById, updateLeadStage, type Lead, type LeadStage } from '@/lib/db/leads';
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

function inferLeadStageFromMessages(
  lead: Lead,
  messages: Array<{ role: 'agent' | 'investor'; content: string }>
): LeadStage | null {
  if (
    lead.stage !== 'outreach_sent' &&
    lead.stage !== 'qualifying' &&
    lead.stage !== 'disqualified'
  ) {
    return null;
  }

  const latestAgentMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'agent');

  if (!latestAgentMessage) {
    return null;
  }

  const lower = latestAgentMessage.content.toLowerCase();
  const allAgentContent = messages
    .filter((message) => message.role === 'agent')
    .map((message) => message.content.toLowerCase())
    .join('\n');

  if (
    lower.includes("you're in") ||
    lower.includes('qualified for the deal room') ||
    lower.includes('deal room access is now active') ||
    allAgentContent.includes('[ui:deal_card]') ||
    allAgentContent.includes('[ui:kyc_prompt]')
  ) {
    return 'deal_room';
  }

  if (
    lower.includes('not the right fit') ||
    lower.includes('not eligible') ||
    lower.includes('cannot proceed') ||
    lower.includes('not a fit')
  ) {
    return 'disqualified';
  }

  return null;
}

async function reconcileLeadStage(
  lead: Lead,
  messages: Array<{ role: 'agent' | 'investor'; content: string }>
): Promise<Lead> {
  const inferredStage = inferLeadStageFromMessages(lead, messages);

  if (!inferredStage || inferredStage === lead.stage) {
    return lead;
  }

  await updateLeadStage(lead.id, inferredStage);
  return {
    ...lead,
    stage: inferredStage,
  };
}

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
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;

    let lead = await getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const messages = await getMessagesByLeadId(leadId);
    lead = await reconcileLeadStage(lead, messages);
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

    let lead = await getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const existingMessages = await getMessagesByLeadId(leadId);
    lead = await reconcileLeadStage(lead, existingMessages);

    // Process message through agent orchestrator
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
      new URL(request.url).origin;

    const response = await orchestrator.processMessage(lead, message, {
      appUrl,
    });

    // Update stage if needed
    if (response.shouldUpdateStage) {
      await updateLeadStage(leadId, response.shouldUpdateStage);
    }

    const nextStage = response.shouldUpdateStage || lead.stage;
    const qualificationState = await getQualificationState(leadId, nextStage);

    if (response.shouldUpdateStage === 'deal_room' && lead.stage !== 'deal_room') {
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
