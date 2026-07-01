import type { Lead } from '@/lib/db/leads';
import { logAuditEvent } from '@/lib/db/audit';
import { getKycDocumentsByLeadId, hasAuditEventForLead } from '@/lib/db/kyc';
import { markKYCSubmitted } from '@/lib/db/leads';
import { getLatestQualificationAnswerMap } from '@/lib/db/qualification';
import {
  detectDocumentTypeFromStoredDocTypes,
  getKycDocumentLabel,
  getRequiredStoredKycDocTypes,
} from '@/lib/kyc/config';
import {
  getAdminKycSubmissionEmailTemplate,
} from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/resend-client';
import {
  getEnhancedDueDiligenceFlags,
  getKycRiskLevel,
  getRequiredAdditionalKycDocTypes,
  humanizeKycAnswerField,
  humanizeKycDocumentType,
  KYC_MINIMUM_REQUIRED_ANSWER_FIELDS,
  KYC_REVIEWER_RECOMMENDED_ANSWER_FIELDS,
  isKycSourceOfFundsType,
  type KycRiskLevel,
} from '@/lib/kyc/requirements';
import { getRequiredEmailEnv } from '@/lib/security/env';

const ADMIN_ALERT_EMAIL = getRequiredEmailEnv('ADMIN_ALERT_EMAIL');

export interface KycSubmissionValidationResult {
  valid: boolean;
  documentTypeLabel?: string;
  missingAnswers: string[];
  missingDocuments: string[];
  recommendedMissingAnswers: string[];
  recommendedMissingDocuments: string[];
  riskLevel: KycRiskLevel;
  requiresEnhancedReview: boolean;
  enhancedReviewFlags: string[];
}

export async function validateKycSubmission(
  leadId: string
): Promise<KycSubmissionValidationResult> {
  const latestAnswers = await getLatestQualificationAnswerMap(leadId);
  const enhancedReviewFlags = getEnhancedDueDiligenceFlags(latestAnswers);
  const riskLevel = getKycRiskLevel(latestAnswers);
  const hasConsent = await hasAuditEventForLead(leadId, 'kyc_consent_given');

  const missingAnswers = KYC_MINIMUM_REQUIRED_ANSWER_FIELDS.filter(
    (field) => !latestAnswers[field]?.answer?.trim()
  ).map(humanizeKycAnswerField);
  const recommendedMissingAnswers =
    KYC_REVIEWER_RECOMMENDED_ANSWER_FIELDS.filter(
      (field) => !latestAnswers[field]?.answer?.trim()
    ).map(humanizeKycAnswerField);

  const documents = await getKycDocumentsByLeadId(leadId);
  const docTypes = documents.map((document) => document.docType);
  const documentType = detectDocumentTypeFromStoredDocTypes(docTypes);

  const missingDocuments: string[] = [];

  if (!documentType) {
    missingDocuments.push('identity document selection');
  } else {
    missingDocuments.push(
      ...getRequiredStoredKycDocTypes(documentType)
        .filter((requiredDocType) => !docTypes.includes(requiredDocType))
        .map(humanizeKycDocumentType)
    );
  }

  const sourceOfFundsType = latestAnswers.source_of_funds_type?.answer?.trim();
  const recommendedMissingDocuments: string[] = [];
  if (sourceOfFundsType && isKycSourceOfFundsType(sourceOfFundsType)) {
    recommendedMissingDocuments.push(
      ...getRequiredAdditionalKycDocTypes(sourceOfFundsType)
        .filter((requiredDocType) => !docTypes.includes(requiredDocType))
        .map(humanizeKycDocumentType)
    );
  }

  return {
    valid:
      hasConsent &&
      missingAnswers.length === 0 &&
      missingDocuments.length === 0,
    documentTypeLabel: documentType
      ? getKycDocumentLabel(documentType)
      : undefined,
    missingAnswers,
    missingDocuments,
    recommendedMissingAnswers,
    recommendedMissingDocuments,
    riskLevel,
    requiresEnhancedReview: enhancedReviewFlags.length > 0,
    enhancedReviewFlags,
  };
}

export async function completeKycSubmission(params: {
  lead: Lead;
  appUrl?: string;
}): Promise<KycSubmissionValidationResult> {
  const validation = await validateKycSubmission(params.lead.id);

  if (!validation.valid) {
    return validation;
  }

  await markKYCSubmitted(params.lead.id);
  await logAuditEvent({
    leadId: params.lead.id,
    eventType: 'kyc_submitted',
    metadata: {
      document_type: validation.documentTypeLabel,
      risk_level: validation.riskLevel,
    },
  });

  if (validation.requiresEnhancedReview) {
    await logAuditEvent({
      leadId: params.lead.id,
      eventType: 'kyc_enhanced_review_flagged',
      metadata: {
        risk_level: validation.riskLevel,
        flags: validation.enhancedReviewFlags,
      },
    });
  }

  const appUrl =
    params.appUrl?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    '';

  if (appUrl) {
    const emailTemplate = getAdminKycSubmissionEmailTemplate({
      investorEmail: params.lead.email,
      leadId: params.lead.id,
      chatLink: `${appUrl}/chat/${params.lead.id}`,
    });

    await sendEmail({
      to: ADMIN_ALERT_EMAIL,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });
  }

  return validation;
}
