import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { toChatMessages } from '@/lib/chat/messages';
import { getLeadById } from '@/lib/db/leads';
import { getMessagesByLeadId } from '@/lib/db/messages';
import { execute } from '@/lib/db/client';
import {
  getLatestQualificationAnswerMap,
} from '@/lib/db/qualification';
import {
  getNextQualificationQuestion,
  type QualificationQuestion,
} from '@/lib/agent/qualification';
import { orchestrator } from '@/lib/agent/orchestrator';
import {
  buildPipelineStatusData,
  createComponentMetadata,
  parseUIComponentMetadata,
} from '@/lib/chat/components';
import { sendEmail } from '@/lib/email/resend-client';
import { getDealRoomAccessEmailTemplate } from '@/lib/email/templates';
import { logAuditEvent } from '@/lib/db/audit';
import {
  setInvestorSessionCookie,
  signInvestorSession,
} from '@/lib/investor-auth';

const BINARY_QUALIFICATION_QUESTIONS = new Set<QualificationQuestion>([
  'investment_horizon',
  'ticket_size',
  'kyc_willingness',
]);

const AGREEMENT_APPROVAL_TEXT =
  'Great news — your identity has been verified by our compliance team. You are now cleared to review and sign your investment agreement.';

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

async function ensureAgreementReadyMessages(lead: Awaited<ReturnType<typeof getLeadById>>) {
  if (
    !lead ||
    lead.stage !== 'agreement_pending' ||
    lead.kyc_approved !== 1 ||
    !lead.approved_by
  ) {
    return;
  }

  const messages = await getMessagesByLeadId(lead.id);
  const hasApprovalText = messages.some(
    (message) =>
      message.role === 'agent' && message.content === AGREEMENT_APPROVAL_TEXT
  );
  const hasAgreementReadyCard = messages.some((message) => {
    if (message.role !== 'agent' || !message.metadata) {
      return false;
    }

    return parseUIComponentMetadata(message.metadata)?.component === 'agreement_ready';
  });
  const hasAgreementPipelineStatus = messages.some((message) => {
    if (message.role !== 'agent' || !message.metadata) {
      return false;
    }

    const componentMetadata = parseUIComponentMetadata(message.metadata);

    if (componentMetadata?.component !== 'pipeline_status') {
      return false;
    }

    const pipelineData = componentMetadata.data as {
      currentStage?: string;
    };

    return pipelineData.currentStage === 'agreement_pending';
  });

  if (hasApprovalText && hasAgreementReadyCard && hasAgreementPipelineStatus) {
    return;
  }

  let nextCreatedAt = Math.max(
    lead.kyc_reviewed_at ?? 0,
    messages.at(-1)?.created_at ?? 0
  );

  if (!hasApprovalText) {
    nextCreatedAt += 1;
    await execute(
      `INSERT INTO messages (id, lead_id, role, content, metadata, created_at)
       VALUES (?, ?, 'agent', ?, NULL, ?)`,
      [nanoid(), lead.id, AGREEMENT_APPROVAL_TEXT, nextCreatedAt]
    );
  }

  if (!hasAgreementReadyCard) {
    nextCreatedAt += 1;
    await execute(
      `INSERT INTO messages (id, lead_id, role, content, metadata, created_at)
       VALUES (?, ?, 'agent', '', ?, ?)`,
      [
        nanoid(),
        lead.id,
        JSON.stringify({
          component: 'agreement_ready',
          data: {
            agreementUrl: `/agreement/${lead.id}`,
            spvName: 'Akwa Ibom Hospitality SPV',
          },
        }),
        nextCreatedAt,
      ]
    );
  }

  if (!hasAgreementPipelineStatus) {
    nextCreatedAt += 1;
    await execute(
      `INSERT INTO messages (id, lead_id, role, content, metadata, created_at)
       VALUES (?, ?, 'agent', '', ?, ?)`,
      [
        nanoid(),
        lead.id,
        JSON.stringify(
          createComponentMetadata(
            'pipeline_status',
            buildPipelineStatusData('agreement_pending')
          )
        ),
        nextCreatedAt,
      ]
    );
  }
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

    await ensureAgreementReadyMessages(lead);
    const messages = await getMessagesByLeadId(leadId);
    const qualificationState = await getQualificationState(leadId, lead.stage);

    const chatResponse = NextResponse.json({
      lead,
      messages: toChatMessages(messages),
      qualificationState,
    });

    const token = await signInvestorSession({
      leadId: lead.id,
      email: lead.email,
      role: 'investor',
    });
    setInvestorSessionCookie(chatResponse, token);

    return chatResponse;
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

    const orchestratorResponse = await orchestrator.processMessage(lead, message, {
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

    const chatResponse = NextResponse.json({
      messages: toChatMessages(orchestratorResponse.agentMessages),
      stage: nextStage,
      qualificationState,
    });

    const token = await signInvestorSession({
      leadId: updatedLead.id,
      email: updatedLead.email,
      role: 'investor',
    });
    setInvestorSessionCookie(chatResponse, token);

    return chatResponse;
  } catch (error) {
    console.error('Error processing message:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}
