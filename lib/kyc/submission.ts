import type { Lead } from '@/lib/db/leads';
import { logAuditEvent } from '@/lib/db/audit';
import { getKycDocumentsByLeadId, hasAuditEventForLead } from '@/lib/db/kyc';
import { markKYCSubmitted } from '@/lib/db/leads';
import { getLatestQualificationAnswerMap } from '@/lib/db/qualification';
import {
  detectDocumentTypeFromStoredDocTypes,
  getRequiredStoredKycDocTypes,
  getKycDocumentLabel,
  KYC_PERSONAL_DETAIL_FIELDS,
} from '@/lib/kyc/config';
import { getAdminKycSubmissionEmailTemplate } from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/resend-client';

const ADMIN_ALERT_EMAIL =
  process.env.ADMIN_ALERT_EMAIL || 'osasisorae@gmail.com';

export interface KycSubmissionValidationResult {
  valid: boolean;
  documentTypeLabel?: string;
  missingPersonalDetails: string[];
  missingDocuments: string[];
}

function humanizePersonalDetailField(field: string): string {
  switch (field) {
    case 'full_legal_name':
      return 'full legal name';
    case 'date_of_birth':
      return 'date of birth';
    case 'nationality':
      return 'nationality';
    case 'country_of_residence':
      return 'country of residence';
    case 'phone_number':
      return 'phone number';
    default:
      return field.replace(/_/g, ' ');
  }
}

function humanizeStoredDocType(docType: string): string {
  return docType.replace(/_/g, ' ');
}

export async function validateKycSubmission(
  leadId: string
): Promise<KycSubmissionValidationResult> {
  const hasConsent = await hasAuditEventForLead(leadId, 'kyc_consent_given');

  if (!hasConsent) {
    return {
      valid: false,
      missingPersonalDetails: [],
      missingDocuments: [],
    };
  }

  const latestAnswers = await getLatestQualificationAnswerMap(leadId);
  const missingPersonalDetails = KYC_PERSONAL_DETAIL_FIELDS.filter(
    (field) => !latestAnswers[field]?.answer?.trim()
  ).map(humanizePersonalDetailField);

  const documents = await getKycDocumentsByLeadId(leadId);
  const docTypes = documents.map((document) => document.docType);
  const documentType = detectDocumentTypeFromStoredDocTypes(docTypes);

  if (!documentType) {
    return {
      valid: false,
      missingPersonalDetails,
      missingDocuments: ['identity document selection'],
    };
  }

  const requiredDocumentTypes = getRequiredStoredKycDocTypes(documentType);
  const missingDocuments = requiredDocumentTypes
    .filter((requiredDocType) => !docTypes.includes(requiredDocType))
    .map(humanizeStoredDocType);

  return {
    valid: missingPersonalDetails.length === 0 && missingDocuments.length === 0,
    documentTypeLabel: getKycDocumentLabel(documentType),
    missingPersonalDetails,
    missingDocuments,
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
    },
  });

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
