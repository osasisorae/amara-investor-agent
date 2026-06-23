import { Lead, LeadStage } from '../db/leads';
import { getConversationHistory, saveMessage } from '../db/messages';
import { logAuditEvent } from '../db/audit';
import { callQwenWithSystemPrompt } from '../qwen/client';
import { getSystemPromptForStage } from './prompts';
import { loadKnowledgeBase } from '../knowledge-base/loader';

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
      case 'qualifying':
        response = await this.handleQualification(lead, investorMessage);
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
    const conversationHistory = await getConversationHistory(lead.id);
    const systemPrompt = getSystemPromptForStage('qualifying');

    const response = await callQwenWithSystemPrompt(
      systemPrompt,
      message,
      conversationHistory
    );

    // Check if qualification is complete
    // For hackathon: simple keyword detection
    // In production: more sophisticated NLU
    const isQualified = this.detectQualificationComplete(response);
    const isDisqualified = this.detectDisqualification(response);

    if (isQualified) {
      await logAuditEvent({
        leadId: lead.id,
        eventType: 'qualification_passed',
      });

      return {
        message: response,
        shouldUpdateStage: 'deal_room',
        metadata: { qualified: true },
      };
    }

    if (isDisqualified) {
      await logAuditEvent({
        leadId: lead.id,
        eventType: 'qualification_failed',
      });

      return {
        message: response,
        shouldUpdateStage: 'disqualified',
        metadata: { disqualified: true },
      };
    }

    return { message: response };
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

      return {
        message: response,
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

  /**
   * Helper: Detect if qualification is complete
   */
  private detectQualificationComplete(response: string): boolean {
    const qualifiedKeywords = [
      'congratulations',
      'qualified',
      'deal room',
      'access granted',
      'you meet the criteria',
    ];

    const lowerResponse = response.toLowerCase();
    return qualifiedKeywords.some((keyword) =>
      lowerResponse.includes(keyword)
    );
  }

  /**
   * Helper: Detect if investor was disqualified
   */
  private detectDisqualification(response: string): boolean {
    const disqualifiedKeywords = [
      "don't qualify",
      'not eligible',
      'cannot proceed',
      'unfortunately',
      'minimum requirement',
    ];

    const lowerResponse = response.toLowerCase();
    return disqualifiedKeywords.some((keyword) =>
      lowerResponse.includes(keyword)
    );
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
