import { Lead, LeadStage } from '../db/leads';
import { updateLead } from '../db/leads';
import { getConversationHistory, saveMessage } from '../db/messages';
import { logAuditEvent } from '../db/audit';
import {
  getLatestQualificationAnswerMap,
  saveQualificationAnswer,
} from '../db/qualification';
import { callQwenWithSystemPrompt } from '../qwen/client';
import { getSystemPromptForStage } from './prompts';
import { loadKnowledgeBase } from '../knowledge-base/loader';
import {
  assessQualificationResponse,
  buildFutureInterestNote,
  detectFutureInterestRequest,
  getDisqualificationReason,
  getNextQualificationQuestion,
  QUALIFICATION_SEQUENCE,
  type QualificationQuestion,
} from './qualification';

export interface OrchestratorResponse {
  message: string;
  shouldUpdateStage?: LeadStage;
  metadata?: Record<string, any>;
}

export class AgentOrchestrator {
  /**
   * Main entry point for processing investor messages
   */
  async processMessage(
    lead: Lead,
    investorMessage: string
  ): Promise<OrchestratorResponse> {
    // Check if agent is frozen (waiting for human approval)
    if (lead.stage === 'pending_human_review') {
      return {
        message:
          "Thank you for your patience. Your KYC documents are currently under review by our compliance team. I'll notify you as soon as they've been reviewed. This typically takes 1-2 business days.",
      };
    }

    if (lead.stage === 'kyc_rejected') {
      return {
        message:
          "Unfortunately, your KYC documents were not approved. Please check your email for specific feedback from our compliance team, or contact us directly at info@investfuturex.com for assistance.",
      };
    }

    // Save investor message
    await saveMessage({
      leadId: lead.id,
      role: 'investor',
      content: investorMessage,
    });

    // Route to appropriate handler based on stage
    let response: OrchestratorResponse;

    switch (lead.stage) {
      case 'outreach_sent':
      case 'qualifying':
        response = await this.handleQualification(lead, investorMessage);
        break;
      case 'disqualified':
        response = await this.handleDisqualifiedFollowUp(lead, investorMessage);
        break;
      case 'deal_room':
        response = await this.handleDealRoomQuery(lead, investorMessage);
        break;
      case 'kyc_intake':
        response = await this.handleKYCGuidance(lead, investorMessage);
        break;
      case 'agreement_pending':
        response = await this.handleAgreementStage(lead, investorMessage);
        break;
      default:
        response = await this.handleQualification(lead, investorMessage);
    }

    // Save agent response
    await saveMessage({
      leadId: lead.id,
      role: 'agent',
      content: response.message,
      metadata: response.metadata,
    });

    return response;
  }

  /**
   * Handle qualification stage
   */
  private async handleQualification(
    lead: Lead,
    message: string
  ): Promise<OrchestratorResponse> {
    const latestAnswers = await getLatestQualificationAnswerMap(lead.id);
    const currentQuestion = getNextQualificationQuestion(
      Object.keys(latestAnswers)
    );
    let failedQuestion: QualificationQuestion | null = null;
    let disqualificationReason: string | null = null;

    if (currentQuestion) {
      const assessment = assessQualificationResponse(currentQuestion, message);

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

    // Check if all criteria passed BEFORE generating AI response
    const allCriteriaPassed = QUALIFICATION_SEQUENCE.every(
      (question) => latestAnswers[question]?.passed === 1
    );

    if (allCriteriaPassed) {
      await logAuditEvent({
        leadId: lead.id,
        eventType: 'qualification_passed',
        metadata: {
          criteria: QUALIFICATION_SEQUENCE,
        },
      });

      return {
        message: "You're in! 🎉 You're qualified for the deal room. I can answer questions about the investment whenever you're ready.",
        shouldUpdateStage: 'deal_room',
        metadata: { qualified: true },
      };
    }

    // If disqualified, handle early
    if (failedQuestion && disqualificationReason) {
      await logAuditEvent({
        leadId: lead.id,
        eventType: 'qualification_failed',
        metadata: {
          criterion: failedQuestion,
          reason: disqualificationReason,
          answer: message,
        },
      });

      const conversationHistory = await getConversationHistory(lead.id);
      const systemPrompt = getSystemPromptForStage('qualifying');
      const response = await callQwenWithSystemPrompt(
        systemPrompt,
        message,
        conversationHistory
      );

      return {
        message: response,
        shouldUpdateStage: 'disqualified',
        metadata: {
          disqualified: true,
          criterion: failedQuestion,
          reason: disqualificationReason,
        },
      };
    }

    // Continue qualification conversation
    const conversationHistory = await getConversationHistory(lead.id);
    const systemPrompt = getSystemPromptForStage('qualifying');

    const response = await callQwenWithSystemPrompt(
      systemPrompt,
      message,
      conversationHistory
    );

    return {
      message: response,
      shouldUpdateStage: lead.stage === 'outreach_sent' ? 'qualifying' : undefined,
    };
  }

  /**
   * Handle deal room queries with knowledge base
   */
  private async handleDealRoomQuery(
    lead: Lead,
    message: string
  ): Promise<OrchestratorResponse> {
    const conversationHistory = await getConversationHistory(lead.id);
    const systemPrompt = getSystemPromptForStage('deal_room');

    // Load knowledge base
    const knowledgeBase = loadKnowledgeBase();

    // Augment system prompt with knowledge base
    const augmentedPrompt = `${systemPrompt}\n\n**Knowledge Base:**\n${knowledgeBase}`;

    const response = await callQwenWithSystemPrompt(
      augmentedPrompt,
      message,
      conversationHistory
    );

    // Check if investor is ready for KYC
    const readyForKYC = this.detectKYCReadiness(message);

    if (readyForKYC) {
      await logAuditEvent({
        leadId: lead.id,
        eventType: 'deal_room_accessed',
      });

      // Move to KYC intake stage
      return {
        message: response + "\n\nGreat! Let's proceed with KYC verification. I'll guide you through the document upload process.",
        shouldUpdateStage: 'kyc_intake',
        metadata: { moving_to_kyc: true },
      };
    }

    return { message: response };
  }

  /**
   * Handle KYC guidance
   */
  private async handleKYCGuidance(
    lead: Lead,
    message: string
  ): Promise<OrchestratorResponse> {
    const conversationHistory = await getConversationHistory(lead.id);
    const systemPrompt = getSystemPromptForStage('kyc_intake');

    const response = await callQwenWithSystemPrompt(
      systemPrompt,
      message,
      conversationHistory
    );

    return { message: response };
  }

  /**
   * Handle agreement stage
   */
  private async handleAgreementStage(
    lead: Lead,
    message: string
  ): Promise<OrchestratorResponse> {
    return {
      message:
        "Your KYC has been approved! I'll send you the investment agreement shortly. Please review it carefully and let me know when you're ready to sign.",
    };
  }

  private async handleDisqualifiedFollowUp(
    lead: Lead,
    message: string
  ): Promise<OrchestratorResponse> {
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
        message:
          "Noted. I've recorded your interest for future opportunities that may be a better fit, and our team can follow up when something aligned becomes available.",
        metadata: {
          future_interest: true,
          note,
        },
      };
    }

    return {
      message:
        "This specific opportunity is not the right fit based on your qualification responses. If you'd like, I can note your interest for future offerings that may align better with your goals.",
    };
  }

  /**
   * Helper: Detect if investor is ready for KYC
   */
  private detectKYCReadiness(message: string): boolean {
    const kycKeywords = [
      'kyc',
      'documents',
      'verification',
      'ready to proceed',
      'next step',
      'how do i invest',
    ];

    const lowerMessage = message.toLowerCase();
    return kycKeywords.some((keyword) => lowerMessage.includes(keyword));
  }
}

export const orchestrator = new AgentOrchestrator();

