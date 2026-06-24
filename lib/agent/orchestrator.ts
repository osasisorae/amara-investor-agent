import { createHash } from 'node:crypto';
import {
  buildKycConsentData,
  buildKycDocumentSelectorData,
  buildDealCardData,
  buildDocumentListData,
  buildDefaultComponentData,
  buildKycPersonalDetailsData,
  buildPipelineStatusData,
  buildKycSubmittedData,
  buildKycUploadData,
  createComponentMetadata,
  getComponentFallbackText,
  isUIComponentType,
  parseUIComponentMetadata,
  type UIComponentDataMap,
  type UIComponentType,
} from '@/lib/chat/components';
import { AuditEventType, logAuditEvent } from '@/lib/db/audit';
import { type Lead, type LeadStage, markLeadQualified, updateLead, updateLeadStage } from '@/lib/db/leads';
import { hasAuditEventForLead } from '@/lib/db/kyc';
import {
  type Message,
  getConversationHistory,
  getMessagesByLeadId,
  saveMessage,
} from '@/lib/db/messages';
import {
  getLatestQualificationAnswerMap,
  saveQualificationAnswer,
} from '@/lib/db/qualification';
import { getAdminHumanReviewEmailTemplate } from '@/lib/email/templates';
import {
  buildGuidedDealRoomAnswer,
  buildGuidedQuestionsData,
} from '@/lib/knowledge-base/deal-room-data';
import { searchKnowledgeBaseStructured } from '@/lib/knowledge-base/loader';
import {
  type QwenConversationMessage,
  type QwenToolCall,
  type QwenToolChoice,
  type QwenToolDefinition,
  createQwenChatCompletion,
} from '@/lib/qwen/client';
import { sendEmail } from '../email/resend-client';
import { completeKycSubmission } from '@/lib/kyc/submission';
import {
  getKycDocumentLabel,
  parseKycDocumentTypeFromMessage,
  type KycPrimaryDocumentType,
} from '@/lib/kyc/config';
import { getSystemPromptForStage } from './prompts';
import {
  assessQualificationResponse,
  buildFutureInterestNote,
  detectFutureInterestRequest,
  getDisqualificationReason,
  getNextQualificationQuestion,
  QUALIFICATION_SEQUENCE,
  type QualificationAssessment,
  type QualificationQuestion,
} from './qualification';

const ADMIN_ALERT_EMAIL =
  process.env.ADMIN_ALERT_EMAIL || 'osasisorae@gmail.com';

const LEAD_STAGES: LeadStage[] = [
  'outreach_sent',
  'qualifying',
  'deal_room',
  'kyc_intake',
  'pending_human_review',
  'kyc_rejected',
  'agreement_pending',
  'agreement_signed',
  'payment_pending',
  'closed',
  'disqualified',
];

const AUDIT_EVENT_TYPES: AuditEventType[] = [
  'outreach_sent',
  'qualification_started',
  'qualification_passed',
  'qualification_failed',
  'future_interest_noted',
  'deal_room_email_sent',
  'deal_room_accessed',
  'human_review_requested',
  'kyc_consent_given',
  'kyc_personal_details_submitted',
  'kyc_document_uploaded',
  'kyc_submitted',
  'kyc_approved',
  'kyc_rejected',
  'agreement_viewed',
  'agreement_signed',
  'otp_sent',
  'payment_instructions_sent',
  'payment_received',
];

const TOOL_DEFINITIONS: QwenToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'send_email',
      description:
        'Send an email to the investor or the FutureX admin inbox when a workflow requires it.',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description:
              'Use "investor" to email the lead or "admin" to email the FutureX team inbox.',
          },
          subject: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_lead_stage',
      description:
        'Move the lead to a new stage when the investor has clearly progressed.',
      parameters: {
        type: 'object',
        properties: {
          newStage: {
            type: 'string',
            enum: LEAD_STAGES,
          },
        },
        required: ['newStage'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_audit_event',
      description:
        'Write a structured audit event for compliance, human review, or workflow milestones.',
      parameters: {
        type: 'object',
        properties: {
          eventType: {
            type: 'string',
            enum: AUDIT_EVENT_TYPES,
          },
          metadata: {
            type: 'object',
            additionalProperties: true,
          },
        },
        required: ['eventType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_knowledge_base',
      description:
        'Search the approved FutureX knowledge base and return only relevant excerpts for a deal-room question.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'flag_for_human_review',
      description:
        'Escalate a lead for manual follow-up when a question needs a direct answer from the FutureX team.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string' },
        },
        required: ['reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'unlock_agreement',
      description:
        'Return the secure agreement link after verifying KYC approval and approver identity.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'emit_ui_component',
      description:
        'Emit a structured UI component as an Amara chat bubble. Use this instead of describing cards, documents, or inline upload UI in plain text.',
      parameters: {
        type: 'object',
        properties: {
          component: {
            type: 'string',
            enum: [
              'deal_card',
              'document_list',
              'pipeline_status',
              'kyc_prompt',
              'kyc_consent',
              'kyc_personal_details',
              'kyc_document_selector',
              'kyc_upload',
              'kyc_submitted',
              'deal_brief',
              'spv_structure',
              'guided_questions',
              'returns_table',
              'revenue_chart',
              'ownership_card',
              'risk_table',
              'timeline_card',
              'exit_card',
            ],
          },
          data: {
            type: 'object',
            additionalProperties: true,
          },
        },
        required: ['component', 'data'],
      },
    },
  },
];

interface ProcessMessageContext {
  appUrl?: string;
}

interface AgentEmission {
  text: string;
  metadata?: Record<string, unknown>;
}

interface HandlerResult {
  emissions: AgentEmission[];
  shouldUpdateStage?: LeadStage;
}

interface ToolExecutionResult {
  content: string;
  emissions?: AgentEmission[];
  stageChange?: LeadStage;
}

export interface OrchestratorResponse {
  agentMessages: Message[];
  shouldUpdateStage?: LeadStage;
}

// Stage ownership rule: lib/agent/orchestrator.ts is the only non-admin writer
// of leads.stage. Admin exceptions live in app/api/admin/kyc/[leadId]/route.ts
// and app/api/admin/payment/[leadId]/route.ts.
export async function applyOrchestratorStageTransition(
  leadId: string,
  newStage: LeadStage
): Promise<void> {
  await updateLeadStage(leadId, newStage);

  if (newStage === 'deal_room') {
    await markLeadQualified(leadId);
  }
}

function isLeadStage(value: string): value is LeadStage {
  return LEAD_STAGES.includes(value as LeadStage);
}

function isAuditEventType(value: string): value is AuditEventType {
  return AUDIT_EVENT_TYPES.includes(value as AuditEventType);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatEmailBodyAsHtml(body: string): string {
  return body
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p>${escapeHtml(paragraph).replace(/\n/g, '<br/>')}</p>`
    )
    .join('');
}

function requiresBinaryResponse(question: QualificationQuestion): boolean {
  return (
    question === 'ticket_size' ||
    question === 'investment_horizon' ||
    question === 'kyc_willingness'
  );
}

function normalizeOrigin(appUrl?: string): string {
  return (
    appUrl?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    ''
  );
}

function getAllowedToolNamesForStage(stage: LeadStage): string[] {
  switch (stage) {
    case 'deal_room':
      return [
        'search_knowledge_base',
        'flag_for_human_review',
        'update_lead_stage',
        'log_audit_event',
        'send_email',
        'emit_ui_component',
      ];
    case 'kyc_intake':
      return [
        'search_knowledge_base',
        'emit_ui_component',
        'update_lead_stage',
        'log_audit_event',
        'flag_for_human_review',
        'send_email',
      ];
    case 'agreement_pending':
      return ['unlock_agreement', 'log_audit_event', 'send_email'];
    default:
      return [];
  }
}

function buildToolPrompt(stage: LeadStage): string {
  if (stage === 'deal_room') {
    return `${getSystemPromptForStage('deal_room')}

Operational rules:
- For every investor question in the deal room, call \`search_knowledge_base\` before giving a final answer.
- Use only the search result to answer due diligence questions. Do not invent facts.
- If the investor asks for return breakdowns, ownership, revenue model, risks, timeline, or Year 5 exit mechanics, use \`emit_ui_component\` with the matching structured component instead of replying with plain text alone.
- If the investor asks for the deal brief, emit \`deal_brief\` after a short text intro.
- If the investor asks for the SPV structure explainer or how the SPV is structured, emit \`spv_structure\` after a short text intro.
- If the investor asks for documents, downloads, or wants source materials, call \`emit_ui_component\` with \`component: "document_list"\`.
- If you answer a substantive due diligence question and there is no previous assistant message containing \`[ui:document_list]\`, proactively emit \`document_list\` once after your answer.
- If the search result shows no relevant answer, call \`flag_for_human_review\` with a concise reason, then tell the investor: "That's a great question that needs a direct answer from our team. I've flagged it for follow-up."
- If the investor clearly says they are ready to move forward, call \`log_audit_event\` with \`deal_room_accessed\`, then call \`update_lead_stage\` to \`kyc_intake\`. Do not send them to another page. Tell them they can upload documents right here in the chat.
- Use \`emit_ui_component\` instead of narrating a dashboard. All UI appears as chat bubbles.
- Keep answers concise and practical.
`;
  }

  if (stage === 'kyc_intake') {
    return `${getSystemPromptForStage('kyc_intake')}

Operational rules:
- Use \`emit_ui_component\` for every structured KYC step instead of describing forms in plain text.
- If the investor asks an investment question during KYC, call \`search_knowledge_base\`, answer briefly from the result, then redirect them back to the KYC step they are currently on.
- If you notify the FutureX team by email, use \`send_email\` with \`to: "admin"\`.
- If you need to reassure the investor after submission, keep it concise and remind them the review window is 2 business days.
- Never approve or reject KYC yourself.
`;
  }

  return `You are Amara supporting an investor who has already passed KYC.

Rules:
- If the investor asks how to sign, where to continue, or says they are ready, call \`unlock_agreement\` and give them the secure link that comes back from the tool.
- Never claim the agreement has been signed or payment has been received.
- If the investor just needs reassurance or clarification, answer briefly and point them toward the agreement link.
- Keep the reply to short paragraphs.`;
}

export class AgentOrchestrator {
  async processMessage(
    lead: Lead,
    investorMessage: string,
    context: ProcessMessageContext = {}
  ): Promise<OrchestratorResponse> {
    await saveMessage({
      leadId: lead.id,
      role: 'investor',
      content: investorMessage,
    });

    const frozenMessage = this.getFrozenStageMessage(lead);
    const handlerResult = frozenMessage
      ? { emissions: [this.emitTextMessage(frozenMessage)] }
      : await this.routeMessage(lead, investorMessage, context);

    const savedAgentMessages: Message[] = [];

    for (const emission of handlerResult.emissions) {
      savedAgentMessages.push(
        await saveMessage({
          leadId: lead.id,
          role: 'agent',
          content: emission.text,
          metadata: emission.metadata,
        })
      );
    }

    return {
      agentMessages: savedAgentMessages,
      shouldUpdateStage: handlerResult.shouldUpdateStage,
    };
  }

  private async routeMessage(
    lead: Lead,
    investorMessage: string,
    context: ProcessMessageContext
  ): Promise<HandlerResult> {
    switch (lead.stage) {
      case 'outreach_sent':
      case 'qualifying':
        return this.handleQualification(lead, investorMessage);
      case 'disqualified':
        return this.handleDisqualifiedFollowUp(lead, investorMessage);
      case 'deal_room':
        return this.handleDealRoomQuery(lead, investorMessage, context);
      case 'kyc_intake':
        return this.handleKYCGuidance(lead, investorMessage, context);
      case 'agreement_pending':
      case 'agreement_signed':
      case 'payment_pending':
      case 'closed':
        return this.handleAgreementStage(lead, investorMessage, context);
      default:
        return this.handleQualification(lead, investorMessage);
    }
  }

  private getFrozenStageMessage(lead: Lead): string | null {
    if (lead.stage === 'pending_human_review') {
      if (lead.kyc_submitted_at) {
        return "Thank you for your patience. Your KYC documents are currently under review by our compliance team. I'll notify you as soon as they've been reviewed.";
      }

      return "I've flagged your question for direct follow-up from our team. They'll review the conversation and get back to you with a precise answer.";
    }

    if (lead.stage === 'kyc_rejected') {
      return "Unfortunately, your KYC documents were not approved. Please check your email for specific feedback from our compliance team, or contact us directly at info@investfuturex.com for assistance.";
    }

    return null;
  }

  private async handleQualification(
    lead: Lead,
    message: string
  ): Promise<HandlerResult> {
    const conversationHistory = await getConversationHistory(lead.id);
    const historyWithoutCurrentMessage = this.stripCurrentUserMessage(
      conversationHistory,
      message
    );
    const latestAnswers = await getLatestQualificationAnswerMap(lead.id);
    const currentQuestion = getNextQualificationQuestion(
      Object.keys(latestAnswers)
    );
    const lastAgentMessage = [...historyWithoutCurrentMessage]
      .reverse()
      .find((entry) => entry.role === 'assistant')?.content;
    const promptedQuestion = lastAgentMessage
      ? this.detectQualificationQuestion(lastAgentMessage)
      : null;
    const questionToAssess =
      promptedQuestion && !latestAnswers[promptedQuestion]
        ? promptedQuestion
        : currentQuestion;
    let currentAssessment: QualificationAssessment | null = null;
    let failedQuestion: QualificationQuestion | null = null;
    let disqualificationReason: string | null = null;

    if (questionToAssess) {
      const assessment = assessQualificationResponse(questionToAssess, message);
      currentAssessment = assessment;

      if (assessment?.matched) {
        await saveQualificationAnswer({
          leadId: lead.id,
          question: assessment.question,
          answer: message,
          passed: assessment.passed,
        });

        latestAnswers[assessment.question] = {
          id: `derived-${assessment.question}`,
          lead_id: lead.id,
          question: assessment.question,
          answer: message,
          passed: assessment.passed ? 1 : 0,
          created_at: Math.floor(Date.now() / 1000),
        };

        if (assessment.location) {
          await updateLead(lead.id, { country: assessment.location });
        }

        if (!assessment.passed) {
          failedQuestion = assessment.question;
          disqualificationReason =
            assessment.reason || getDisqualificationReason(assessment.question);
        }
      }
    }

    if (lead.stage === 'outreach_sent') {
      await logAuditEvent({
        leadId: lead.id,
        eventType: 'qualification_started',
      });
    }

    const allCriteriaPassed = QUALIFICATION_SEQUENCE.every(
      (question) => latestAnswers[question]?.passed === 1
    );

    if (allCriteriaPassed) {
      await applyOrchestratorStageTransition(lead.id, 'deal_room');
      await logAuditEvent({
        leadId: lead.id,
        eventType: 'qualification_passed',
        metadata: {
          criteria: QUALIFICATION_SEQUENCE,
        },
      });

      return {
        emissions: this.buildDealRoomWelcomeSequence(lead.id),
        shouldUpdateStage: 'deal_room',
      };
    }

    if (failedQuestion && disqualificationReason) {
      await applyOrchestratorStageTransition(lead.id, 'disqualified');
      await logAuditEvent({
        leadId: lead.id,
        eventType: 'qualification_failed',
        metadata: {
          criterion: failedQuestion,
          reason: disqualificationReason,
          answer: message,
        },
      });

      return {
        emissions: [
          this.emitTextMessage(
            this.buildDisqualificationMessage(
              failedQuestion,
              disqualificationReason
            ),
            {
            disqualified: true,
            criterion: failedQuestion,
            reason: disqualificationReason,
            }
          ),
        ],
        shouldUpdateStage: 'disqualified',
      };
    }

    const nextQuestion = getNextQualificationQuestion(
      Object.keys(latestAnswers)
    );
    const shouldUpdateStage = lead.stage === 'outreach_sent' ? 'qualifying' : undefined;

    if (shouldUpdateStage) {
      await applyOrchestratorStageTransition(lead.id, shouldUpdateStage);
    }

    return {
      emissions: [
        this.emitTextMessage(
          this.buildQualificationGuidanceMessage(
            message,
            currentAssessment,
            nextQuestion
          ),
          this.buildQualificationPromptMetadata(nextQuestion)
        ),
      ],
      shouldUpdateStage,
    };
  }

  private async handleDealRoomQuery(
    lead: Lead,
    message: string,
    context: ProcessMessageContext
  ): Promise<HandlerResult> {
    const guidedAnswer = buildGuidedDealRoomAnswer(message);

    if (guidedAnswer) {
      const emissions: AgentEmission[] = [
        this.emitTextMessage(guidedAnswer.text),
      ];

      if (guidedAnswer.component) {
        emissions.push(
          this.emitComponentMessage(
            lead.id,
            guidedAnswer.component.type,
            guidedAnswer.component.data
          )
        );
      }

      await this.maybeAppendDealRoomDocuments(lead.id, emissions);

      return { emissions };
    }

    if (this.isDocumentRequest(message)) {
      return {
        emissions: [
          this.emitTextMessage(
            "I've pulled the two core diligence documents into the chat so you can review the structure and deal summary directly."
          ),
          this.emitComponentMessage(
            lead.id,
            'document_list',
            buildDocumentListData()
          ),
        ],
      };
    }

    const kbSearch = searchKnowledgeBaseStructured(message);
    const shouldEscalate =
      !kbSearch.found && this.isLikelyDealRoomKnowledgeQuestion(message);

    if (shouldEscalate) {
      const escalationReason = `No approved knowledge-base answer for deal-room question: ${message}`;
      const escalationResult = await this.flagLeadForHumanReview(
        lead,
        escalationReason,
        normalizeOrigin(context.appUrl)
      );

      return {
        emissions: [
          this.emitTextMessage(
            "That's a great question that needs a direct answer from our team. I've flagged it for follow-up."
          ),
        ],
        shouldUpdateStage: escalationResult.stageChange,
      };
    }

    return this.runToolConversation({
      lead,
      investorMessage: message,
      stage: 'deal_room',
      systemPrompt: buildToolPrompt('deal_room'),
      context,
      initialToolChoice: {
        type: 'function',
        function: { name: 'search_knowledge_base' },
      },
    });
  }

  private isDocumentRequest(message: string): boolean {
    const normalized = message.toLowerCase();

    return (
      normalized.includes('document') ||
      normalized.includes('download') ||
      normalized.includes('deal brief') ||
      normalized.includes('spv structure') ||
      normalized.includes('source material') ||
      normalized.includes('diligence pack')
    );
  }

  private isLikelyDealRoomKnowledgeQuestion(message: string): boolean {
    const normalized = message.toLowerCase().trim();

    if (!normalized) {
      return false;
    }

    if (
      [
        'hi',
        'hello',
        'hey',
        'thanks',
        'thank you',
        'okay',
        'ok',
        'great',
        'sounds good',
      ].includes(normalized)
    ) {
      return false;
    }

    if (
      normalized.includes('ready to move forward') ||
      normalized.includes('ready for kyc') ||
      normalized.includes('ready to proceed') ||
      normalized.includes('let us proceed') ||
      normalized.includes("let's proceed") ||
      normalized.includes("i'm ready") ||
      normalized.includes('upload') ||
      normalized.includes('move to kyc')
    ) {
      return false;
    }

    return (
      normalized.includes('?') ||
      [
        'return',
        'revenue',
        'risk',
        'timeline',
        'exit',
        'spv',
        'ownership',
        'ticket',
        'construction',
        'operations',
        'diaspora',
        'move money',
        'repatriate',
        'fee',
        'yield',
        'deal room',
        'investment',
      ].some((term) => normalized.includes(term))
    );
  }

  private async maybeAppendDealRoomDocuments(
    leadId: string,
    emissions: AgentEmission[]
  ): Promise<void> {
    const messages = await getMessagesByLeadId(leadId);
    const alreadySent = messages.some((message) => {
      const metadata = this.parseStoredMetadata(message.metadata);
      const componentMetadata = metadata
        ? parseUIComponentMetadata(metadata)
        : null;

      return componentMetadata?.component === 'document_list';
    });

    const pendingDocumentList = this.hasComponentEmission(
      emissions,
      'document_list'
    );

    if (alreadySent || pendingDocumentList) {
      return;
    }

    emissions.push(
      this.emitComponentMessage(leadId, 'document_list', buildDocumentListData())
    );
  }

  private async handleKYCGuidance(
    lead: Lead,
    message: string,
    context: ProcessMessageContext
  ): Promise<HandlerResult> {
    const normalizedMessage = message.trim().toLowerCase().replace(/[’]/g, "'");

    if (normalizedMessage === 'i consent and want to proceed') {
      return this.handleKycConsent(lead);
    }

    if (normalizedMessage === 'personal details submitted') {
      return this.handleKycPersonalDetailsSubmitted(lead);
    }

    const selectedDocumentType = parseKycDocumentTypeFromMessage(message);
    if (
      selectedDocumentType &&
      (normalizedMessage.startsWith("i'll use my") ||
        normalizedMessage.startsWith('i will use my') ||
        normalizedMessage.includes('use my'))
    ) {
      return this.handleKycDocumentSelection(lead, selectedDocumentType);
    }

    if (normalizedMessage === 'all documents uploaded') {
      return this.handleKycSubmissionReady(lead, context);
    }

    return this.runToolConversation({
      lead,
      investorMessage: message,
      stage: 'kyc_intake',
      systemPrompt: buildToolPrompt('kyc_intake'),
      context,
      initialToolChoice: 'auto',
    });
  }

  private async handleKycConsent(lead: Lead): Promise<HandlerResult> {
    const alreadyLogged = await hasAuditEventForLead(lead.id, 'kyc_consent_given');

    if (!alreadyLogged) {
      await logAuditEvent({
        leadId: lead.id,
        eventType: 'kyc_consent_given',
      });
    }

    return {
      emissions: [
        this.emitTextMessage(
          "Thanks. Let's capture your personal details first, then we'll move to the document uploads."
        ),
        this.emitComponentMessage(
          lead.id,
          'kyc_personal_details',
          buildKycPersonalDetailsData({
            fullLegalName: lead.full_name || '',
            countryOfResidence: lead.country || '',
            phoneNumber: lead.phone || '',
          })
        ),
      ],
    };
  }

  private async handleKycPersonalDetailsSubmitted(
    lead: Lead
  ): Promise<HandlerResult> {
    return {
      emissions: [
        this.emitTextMessage(
          'Great. Choose the government ID you want to use for this verification.'
        ),
        this.emitComponentMessage(
          lead.id,
          'kyc_document_selector',
          buildKycDocumentSelectorData()
        ),
      ],
    };
  }

  private async handleKycDocumentSelection(
    lead: Lead,
    documentType: KycPrimaryDocumentType | null
  ): Promise<HandlerResult> {
    if (!documentType) {
      return {
        emissions: [
          this.emitTextMessage(
            'I did not catch the document type. Please choose passport, national ID card, or driver’s licence.'
          ),
          this.emitComponentMessage(
            lead.id,
            'kyc_document_selector',
            buildKycDocumentSelectorData()
          ),
        ],
      };
    }

    return {
      emissions: [
        this.emitTextMessage(
          `Perfect. Upload the files for your ${getKycDocumentLabel(
            documentType
          )} and the supporting compliance documents below.`
        ),
        this.emitComponentMessage(
          lead.id,
          'kyc_upload',
          buildKycUploadData(documentType)
        ),
      ],
    };
  }

  private async handleKycSubmissionReady(
    lead: Lead,
    context: ProcessMessageContext
  ): Promise<HandlerResult> {
    console.log('[Orchestrator][KYC] Validating KYC package for lead:', lead.id);
    const result = await completeKycSubmission({
      lead,
      appUrl: normalizeOrigin(context.appUrl),
    });

    if (!result.valid) {
      const missingItems = [
        ...result.missingPersonalDetails,
        ...result.missingDocuments,
      ];

      return {
        emissions: [
          this.emitTextMessage(
            missingItems.length
              ? `You're close, but I still need: ${missingItems.join(
                  ', '
                )}. Once those are in, tap Submit KYC again.`
              : 'I still need your recorded consent before documents can be submitted. Please confirm the consent step first.'
          ),
        ],
      };
    }

    console.log(
      '[Orchestrator][KYC] KYC package complete. Advancing lead to pending_human_review:',
      lead.id
    );
    await applyOrchestratorStageTransition(lead.id, 'pending_human_review');

    return {
      emissions: [
        this.emitTextMessage(
          "Thank you. Your KYC package has been submitted to the FutureX compliance team for review."
        ),
        this.emitComponentMessage(
          lead.id,
          'kyc_submitted',
          buildKycSubmittedData()
        ),
      ],
      shouldUpdateStage: 'pending_human_review',
    };
  }

  private async handleAgreementStage(
    lead: Lead,
    message: string,
    context: ProcessMessageContext
  ): Promise<HandlerResult> {
    return this.runToolConversation({
      lead,
      investorMessage: message,
      stage: 'agreement_pending',
      systemPrompt: buildToolPrompt('agreement_pending'),
      context,
      initialToolChoice: 'auto',
    });
  }

  private async handleDisqualifiedFollowUp(
    lead: Lead,
    message: string
  ): Promise<HandlerResult> {
    const latestAnswers = await getLatestQualificationAnswerMap(lead.id);
    const failedQuestion = QUALIFICATION_SEQUENCE.find(
      (question) => latestAnswers[question]?.passed === 0
    );

    if (detectFutureInterestRequest(message)) {
      const note = buildFutureInterestNote(message, failedQuestion);

      await logAuditEvent({
        leadId: lead.id,
        eventType: 'future_interest_noted',
        metadata: {
          note,
          failed_criterion: failedQuestion,
        },
      });

      return {
        emissions: [
          this.emitTextMessage(
            "Noted. I've recorded your interest for future opportunities that may be a better fit, and our team can follow up when something aligned becomes available.",
            {
              future_interest: true,
              note,
            }
          ),
        ],
      };
    }

    return {
      emissions: [
        this.emitTextMessage(
          "This specific opportunity is not the right fit based on your qualification responses. If you'd like, I can note your interest for future offerings that may align better with your goals."
        ),
      ],
    };
  }

  private async runToolConversation(params: {
    lead: Lead;
    investorMessage: string;
    stage: LeadStage;
    systemPrompt: string;
    context: ProcessMessageContext;
    initialToolChoice: QwenToolChoice;
  }): Promise<HandlerResult> {
    const conversationHistory = await getConversationHistory(params.lead.id);
    const historyWithoutCurrentMessage = this.stripCurrentUserMessage(
      conversationHistory,
      params.investorMessage
    );
    const messages: QwenConversationMessage[] = [
      { role: 'system', content: params.systemPrompt },
      ...historyWithoutCurrentMessage.map((entry) => ({
        role: entry.role,
        content: entry.content,
      })),
      { role: 'user', content: params.investorMessage },
    ];
    const allowedToolNames = new Set(getAllowedToolNamesForStage(params.stage));
    const availableTools = TOOL_DEFINITIONS.filter((tool) =>
      allowedToolNames.has(tool.function.name)
    );
    const pendingEmissions: AgentEmission[] = [];

    let requestedStageChange: LeadStage | undefined;
    let toolChoice: QwenToolChoice = params.initialToolChoice;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const assistantMessage = await createQwenChatCompletion({
        messages,
        tools: availableTools,
        toolChoice,
        temperature: 0.2,
        maxTokens: 1200,
      });

      messages.push({
        role: 'assistant',
        content: assistantMessage.content,
        tool_calls: assistantMessage.tool_calls,
      });

      if (!assistantMessage.tool_calls?.length) {
        const emissions: AgentEmission[] = [];

        if (assistantMessage.content?.trim()) {
          emissions.push(this.emitTextMessage(assistantMessage.content.trim()));
        }

        emissions.push(...pendingEmissions);

        this.appendStageTransitionEmissions(
          params.lead.id,
          requestedStageChange,
          pendingEmissions,
          emissions
        );

        if (emissions.length === 0) {
          emissions.push(
            this.emitTextMessage(
              "I have the context I need. Let me know what part you'd like me to clarify next."
            )
          );
        }

        return {
          emissions,
          shouldUpdateStage: requestedStageChange,
        };
      }

      for (const toolCall of assistantMessage.tool_calls) {
        const result = await this.executeToolCall(
          params.lead,
          toolCall,
          params.context
        );

        if (result.stageChange) {
          requestedStageChange = result.stageChange;
          params.lead = {
            ...params.lead,
            stage: result.stageChange,
          };
        }

        if (result.emissions) {
          pendingEmissions.push(...result.emissions);
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: result.content,
        });
      }

      toolChoice = 'auto';
    }

    const fallbackEmissions: AgentEmission[] = [];
    fallbackEmissions.push(
      this.emitTextMessage(
        "I've taken that as far as I safely can in the system. A FutureX team member will follow up directly if anything still needs manual review."
      )
    );
    fallbackEmissions.push(...pendingEmissions);
    this.appendStageTransitionEmissions(
      params.lead.id,
      requestedStageChange,
      pendingEmissions,
      fallbackEmissions
    );

    return {
      emissions: fallbackEmissions,
      shouldUpdateStage: requestedStageChange,
    };
  }

  private async executeToolCall(
    lead: Lead,
    toolCall: QwenToolCall,
    context: ProcessMessageContext
  ): Promise<ToolExecutionResult> {
    const args = this.parseToolArguments(toolCall);
    const appUrl = normalizeOrigin(context.appUrl);

    switch (toolCall.function.name) {
      case 'send_email': {
        const to = this.requireString(args, 'to');
        const subject = this.requireString(args, 'subject');
        const body = this.requireString(args, 'body');
        const resolvedRecipient =
          to === 'investor'
            ? lead.email
            : to === 'admin'
              ? ADMIN_ALERT_EMAIL
              : to;

        if (
          resolvedRecipient !== lead.email &&
          resolvedRecipient !== ADMIN_ALERT_EMAIL
        ) {
          throw new Error('send_email recipient is outside the allowed set');
        }

        await sendEmail({
          to: resolvedRecipient,
          subject,
          html: formatEmailBodyAsHtml(body),
          text: body,
        });

        return {
          content: JSON.stringify({
            success: true,
            to: resolvedRecipient,
            subject,
            delivery: 'queued',
          }),
        };
      }

      case 'update_lead_stage': {
        const newStage = this.requireString(args, 'newStage');
        if (!isLeadStage(newStage)) {
          throw new Error(`Invalid lead stage: ${newStage}`);
        }

        console.log(
          '[Orchestrator] Tool requested stage transition:',
          JSON.stringify({
            leadId: lead.id,
            from: lead.stage,
            to: newStage,
          })
        );
        await applyOrchestratorStageTransition(lead.id, newStage);

        return {
          content: JSON.stringify({
            success: true,
            newStage,
          }),
          stageChange: newStage,
        };
      }

      case 'log_audit_event': {
        const eventType = this.requireString(args, 'eventType');
        if (!isAuditEventType(eventType)) {
          throw new Error(`Invalid audit event type: ${eventType}`);
        }

        const metadata = this.optionalRecord(args, 'metadata');
        await logAuditEvent({
          leadId: lead.id,
          eventType,
          metadata,
        });

        return {
          content: JSON.stringify({
            success: true,
            eventType,
            metadata,
          }),
        };
      }

      case 'search_knowledge_base': {
        const query = this.requireString(args, 'query');
        const searchResult = searchKnowledgeBaseStructured(query);
        return {
          content: JSON.stringify(searchResult, null, 2),
        };
      }

      case 'flag_for_human_review': {
        const reason = this.requireString(args, 'reason');
        return this.flagLeadForHumanReview(lead, reason, appUrl);
      }

      case 'unlock_agreement': {
        if (lead.kyc_approved !== 1 || !lead.approved_by) {
          throw new Error('Agreement access is locked until KYC is approved');
        }

        if (!appUrl) {
          throw new Error('App URL is required to generate agreement access');
        }

        return {
          content: JSON.stringify({
            success: true,
            agreementLink: `${appUrl}/agreement/${lead.id}`,
          }),
        };
      }

      case 'emit_ui_component': {
        const component = this.requireString(args, 'component');
        if (!isUIComponentType(component)) {
          throw new Error(`Unsupported UI component: ${component}`);
        }

        const data = this.normalizeComponentData(
          component,
          lead.stage,
          this.optionalRecord(args, 'data')
        );

        return {
          content: JSON.stringify({
            success: true,
            component,
          }),
          emissions: [this.emitComponentMessage(lead.id, component, data)],
        };
      }

      default:
        throw new Error(`Unsupported tool: ${toolCall.function.name}`);
    }
  }

  private async flagLeadForHumanReview(
    lead: Lead,
    reason: string,
    appUrl: string
  ): Promise<ToolExecutionResult> {
    await applyOrchestratorStageTransition(lead.id, 'pending_human_review');
    await logAuditEvent({
      leadId: lead.id,
      eventType: 'human_review_requested',
      metadata: {
        reason,
        source_stage: lead.stage,
        fingerprint: createHash('sha256')
          .update(`${lead.id}:${reason}`)
          .digest('hex'),
      },
    });

    if (appUrl) {
      const chatLink = `${appUrl}/chat/${lead.id}`;
      const emailTemplate = getAdminHumanReviewEmailTemplate({
        investorEmail: lead.email,
        leadId: lead.id,
        reason,
        chatLink,
      });

      await sendEmail({
        to: ADMIN_ALERT_EMAIL,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
      });
    }

    return {
      content: JSON.stringify({
        success: true,
        leadId: lead.id,
        escalated: true,
        reason,
      }),
      stageChange: 'pending_human_review',
    };
  }

  private emitTextMessage(
    text: string,
    metadata?: Record<string, unknown>
  ): AgentEmission {
    return {
      text,
      metadata,
    };
  }

  private emitComponentMessage<T extends UIComponentType>(
    leadId: string,
    componentType: T,
    data: UIComponentDataMap[T]
  ): AgentEmission {
    void leadId;

    return {
      text: getComponentFallbackText(componentType),
      metadata: createComponentMetadata(componentType, data) as unknown as Record<
        string,
        unknown
      >,
    };
  }

  private buildDealRoomWelcomeSequence(leadId: string): AgentEmission[] {
    const guidedQuestions = buildGuidedQuestionsData();

    return [
      this.emitTextMessage(
        "Welcome to the FutureX deal room. I'm Amara, your investment guide. Here's an overview of what we're building together."
      ),
      this.emitComponentMessage(leadId, 'deal_card', buildDealCardData()),
      this.emitTextMessage(guidedQuestions.title),
      this.emitComponentMessage(leadId, 'guided_questions', guidedQuestions),
      this.emitComponentMessage(
        leadId,
        'pipeline_status',
        buildPipelineStatusData('deal_room')
      ),
    ];
  }

  private appendStageTransitionEmissions(
    leadId: string,
    nextStage: LeadStage | undefined,
    pendingEmissions: AgentEmission[],
    emissions: AgentEmission[]
  ) {
    if (nextStage !== 'kyc_intake') {
      return;
    }

    if (!this.hasComponentEmission(pendingEmissions, 'pipeline_status')) {
      emissions.push(
        this.emitComponentMessage(
          leadId,
          'pipeline_status',
          buildPipelineStatusData('kyc_intake')
        )
      );
    }

    if (!this.hasComponentEmission(pendingEmissions, 'kyc_consent')) {
      emissions.push(
        this.emitComponentMessage(
          leadId,
          'kyc_consent',
          buildKycConsentData()
        )
      );
    }
  }

  private hasComponentEmission(
    emissions: AgentEmission[],
    componentType: UIComponentType
  ): boolean {
    return emissions.some((emission) => {
      const component = emission.metadata?.component;
      return component === componentType;
    });
  }

  private normalizeComponentData<T extends UIComponentType>(
    component: T,
    currentStage: LeadStage,
    data?: Record<string, unknown>
  ): UIComponentDataMap[T] {
    const defaultData = buildDefaultComponentData(
      component,
      currentStage
    ) as UIComponentDataMap[T];

    if (!data) {
      return defaultData;
    }

    return {
      ...defaultData,
      ...data,
    } as UIComponentDataMap[T];
  }

  private parseToolArguments(
    toolCall: QwenToolCall
  ): Record<string, unknown> {
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      if (!isRecord(parsed)) {
        throw new Error('Tool arguments must be an object');
      }

      return parsed;
    } catch (error) {
      throw new Error(
        `Failed to parse arguments for ${toolCall.function.name}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  private requireString(
    args: Record<string, unknown>,
    key: string
  ): string {
    const value = args[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`Missing required string argument: ${key}`);
    }

    return value.trim();
  }

  private optionalRecord(
    args: Record<string, unknown>,
    key: string
  ): Record<string, unknown> | undefined {
    const value = args[key];
    return isRecord(value) ? value : undefined;
  }

  private parseStoredMetadata(
    value?: string
  ): Record<string, unknown> | undefined {
    if (!value) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  private stripCurrentUserMessage(
    conversationHistory: Array<{ role: 'assistant' | 'user'; content: string }>,
    currentMessage: string
  ) {
    return conversationHistory.at(-1)?.role === 'user' &&
      conversationHistory.at(-1)?.content === currentMessage
      ? conversationHistory.slice(0, -1)
      : conversationHistory;
  }

  private detectQualificationQuestion(
    message: string
  ): QualificationQuestion | null {
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes('diaspora') ||
      lowerMessage.includes('high net worth') ||
      lowerMessage.includes('hni') ||
      lowerMessage.includes('outside nigeria')
    ) {
      return 'investor_profile';
    }

    if (
      lowerMessage.includes('₦5') ||
      lowerMessage.includes('ngn 5') ||
      lowerMessage.includes('$3,300') ||
      lowerMessage.includes('ticket size') ||
      lowerMessage.includes('minimum ticket')
    ) {
      return 'ticket_size';
    }

    if (
      lowerMessage.includes('5 years') ||
      lowerMessage.includes('5-year') ||
      lowerMessage.includes('hold period') ||
      lowerMessage.includes('investment period')
    ) {
      return 'investment_horizon';
    }

    if (
      lowerMessage.includes('kyc') ||
      lowerMessage.includes('verify your identity') ||
      lowerMessage.includes('proof of identity')
    ) {
      return 'kyc_willingness';
    }

    return null;
  }

  private buildQualificationGuidanceMessage(
    message: string,
    assessment: QualificationAssessment | null,
    nextQuestion: QualificationQuestion | null
  ): string {
    if (assessment?.matched && assessment.passed && nextQuestion) {
      return this.buildNextQualificationQuestion(assessment, nextQuestion);
    }

    if (nextQuestion) {
      return this.buildQualificationQuestionPrompt(message, nextQuestion);
    }

    return "Tell me a bit more about your situation, and I'll guide you through the next step.";
  }

  private buildQualificationPromptMetadata(
    nextQuestion: QualificationQuestion | null
  ): Record<string, unknown> | undefined {
    if (!nextQuestion || !requiresBinaryResponse(nextQuestion)) {
      return undefined;
    }

    return {
      qualificationQuestion: nextQuestion,
      expectsBinaryResponse: true,
    };
  }

  private buildNextQualificationQuestion(
    assessment: QualificationAssessment,
    nextQuestion: QualificationQuestion
  ): string {
    switch (nextQuestion) {
      case 'ticket_size':
        if (assessment.question === 'investor_profile' && assessment.location) {
          return `Great. Since you're based in ${assessment.location}, that works for the diaspora requirement. Can you comfortably invest ₦5 million or more?`;
        }

        return 'Great. That works for the investor profile requirement. Can you comfortably invest ₦5 million or more?';
      case 'investment_horizon':
        return 'Perfect. Can you keep the investment in place for at least 5 years?';
      case 'kyc_willingness':
        return 'Great. Last step: are you comfortable completing KYC, including ID, proof of address, and source-of-funds checks?';
      case 'investor_profile':
        return this.buildQualificationQuestionPrompt('', 'investor_profile');
    }
  }

  private buildQualificationQuestionPrompt(
    message: string,
    question: QualificationQuestion
  ): string {
    const lowerMessage = message.toLowerCase();
    const wantsProcessWalkthrough =
      lowerMessage.includes('step by step') ||
      lowerMessage.includes('walk me through') ||
      lowerMessage.includes('how does this work') ||
      lowerMessage.includes('what is the process');

    switch (question) {
      case 'investor_profile':
        if (wantsProcessWalkthrough) {
          return "I'll guide you through a few quick checks to see whether this offer fits. First, are you part of the Nigerian diaspora? If so, tell me where you're based, or if you're in Nigeria let me know if you're a verified HNI.";
        }

        return "To start, tell me where you're based. If you're outside Nigeria, that counts toward the diaspora requirement. If you're in Nigeria, let me know if you're a verified HNI.";
      case 'ticket_size':
        return 'The minimum investment is ₦5 million, roughly $3,300. Does that work for you?';
      case 'investment_horizon':
        return 'This investment has a minimum 5-year hold. Are you comfortable with that timeframe?';
      case 'kyc_willingness':
        return 'Last step: are you comfortable completing KYC, including ID, proof of address, and source-of-funds checks?';
    }
  }

  private buildDisqualificationMessage(
    question: QualificationQuestion,
    reason: string
  ): string {
    switch (question) {
      case 'investor_profile':
        return "Thanks for clarifying. This opportunity is for Nigerian diaspora investors or verified HNIs based in Nigeria, so this one isn't the right fit. If you'd like, I can note your interest for future opportunities.";
      case 'ticket_size':
        return "Thanks for the clarity. This opportunity has a minimum ticket of ₦5 million or the USD equivalent, so it isn't the right fit right now. If you'd like, I can note your interest for future opportunities.";
      case 'investment_horizon':
        return "Thanks for the honesty. This opportunity requires a minimum 5-year hold, so it isn't the right fit for your current goals. If you'd like, I can note your interest for future opportunities with a shorter or more flexible horizon.";
      case 'kyc_willingness':
        return `Thanks for the honesty. ${reason} If you'd like, I can note your interest for future opportunities.`;
    }
  }
}

export const orchestrator = new AgentOrchestrator();
