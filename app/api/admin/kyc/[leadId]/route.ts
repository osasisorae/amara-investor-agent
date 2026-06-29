import { nanoid } from 'nanoid';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import {
  buildPipelineStatusData,
  createComponentMetadata,
} from '@/lib/chat/components';
import { buildInvestorAccessUrl } from '@/lib/chat/access-link';
import { logAuditEvent } from '@/lib/db/audit';
import { execute } from '@/lib/db/client';
import {
  deleteKycDocumentsByLeadId,
  getKycDocumentsByLeadId,
} from '@/lib/db/kyc';
import {
  approveKYC,
  getLeadById,
  returnKYCToIntake,
} from '@/lib/db/leads';
import { getRecentMessagesByLeadId } from '@/lib/db/messages';
import { getLatestQualificationAnswerMap } from '@/lib/db/qualification';
import {
  getKYCApprovalEmailTemplate,
  getKycRejectionEmailTemplate,
} from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/resend-client';
import { validateKycSubmission } from '@/lib/kyc/submission';
import {
  getEnhancedDueDiligenceFlags,
  isKycPaymentMethod,
  isKycSourceOfFundsType,
  getKycPaymentMethodLabel,
  getKycSourceOfFundsLabel,
  KYC_RISK_DECLARATION_DEFINITIONS,
} from '@/lib/kyc/requirements';
import { deleteFile } from '@/lib/storage/r2';

function getStringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getAnswer(
  answers: Record<string, { answer?: string | null }>,
  key: string
): string {
  return (answers[key]?.answer || '').trim();
}

function formatYesNo(value: string): string {
  if (value === 'yes') {
    return 'Yes';
  }

  if (value === 'no') {
    return 'No';
  }

  return '';
}

function getPersonalDetails(
  answers: Record<string, { answer?: string | null }>
): {
  fullLegalName: string;
  dateOfBirth: string;
  nationality: string;
  countryOfResidence: string;
  phoneNumber: string;
} {
  return {
    fullLegalName: getAnswer(answers, 'full_legal_name'),
    dateOfBirth: getAnswer(answers, 'date_of_birth'),
    nationality: getAnswer(answers, 'nationality'),
    countryOfResidence: getAnswer(answers, 'country_of_residence'),
    phoneNumber: getAnswer(answers, 'phone_number'),
  };
}

function getInvestorProfile(
  answers: Record<string, { answer?: string | null }>
) {
  return {
    occupation: getAnswer(answers, 'occupation'),
    employerOrBusinessName: getAnswer(answers, 'employer_or_business_name'),
    employerOrBusinessAddress: getAnswer(
      answers,
      'employer_or_business_address'
    ),
    taxResidencyCountry: getAnswer(answers, 'tax_residency_country'),
    taxIdentificationNumber: getAnswer(answers, 'tax_identification_number'),
  };
}

function getFundingSource(
  answers: Record<string, { answer?: string | null }>
) {
  const sourceOfFundsType = getAnswer(answers, 'source_of_funds_type');

  return {
    sourceOfFundsType,
    sourceOfFundsLabel: sourceOfFundsType
      ? isKycSourceOfFundsType(sourceOfFundsType)
        ? getKycSourceOfFundsLabel(sourceOfFundsType)
        : sourceOfFundsType
      : '',
    sourceOfFundsSummary: getAnswer(answers, 'source_of_funds_summary'),
    sourceOfWealthSummary: getAnswer(answers, 'source_of_wealth_summary'),
  };
}

function getRiskDeclarations(
  answers: Record<string, { answer?: string | null }>
) {
  return KYC_RISK_DECLARATION_DEFINITIONS.map((definition) => ({
    key: definition.key,
    label: definition.label,
    description: definition.description,
    value: getAnswer(answers, definition.key),
    displayValue: formatYesNo(getAnswer(answers, definition.key)) || 'Not provided',
  }));
}

function getPaymentAccount(
  answers: Record<string, { answer?: string | null }>
) {
  const expectedFundingMethod = getAnswer(answers, 'expected_funding_method');

  return {
    expectedFundingMethod,
    expectedFundingMethodLabel: expectedFundingMethod
      ? isKycPaymentMethod(expectedFundingMethod)
        ? getKycPaymentMethodLabel(expectedFundingMethod)
        : expectedFundingMethod
      : '',
    expectedFundingBankCountry: getAnswer(
      answers,
      'expected_funding_bank_country'
    ),
    expectedFundingAccountName: getAnswer(
      answers,
      'expected_funding_account_name'
    ),
    paymentFromOwnAccount: getAnswer(answers, 'payment_from_own_account'),
    paymentFromOwnAccountLabel:
      formatYesNo(getAnswer(answers, 'payment_from_own_account')) ||
      'Not provided',
  };
}

async function purgeStoredKycDocuments(leadId: string): Promise<void> {
  const documents = await getKycDocumentsByLeadId(leadId);

  for (const document of documents) {
    await deleteFile(document.filename);
  }

  await deleteKycDocumentsByLeadId(leadId);
}

// Stage ownership rule: only lib/agent/orchestrator.ts and the admin KYC/payment
// endpoints may write leads.stage. This route owns admin KYC approve/reject changes.
export async function GET(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const session = await verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leadId } = params;
    const lead = await getLeadById(leadId);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const [latestAnswers, messages, validation] = await Promise.all([
      getLatestQualificationAnswerMap(leadId),
      getRecentMessagesByLeadId(leadId, 10),
      validateKycSubmission(leadId),
    ]);

    const enhancedReviewFlags = getEnhancedDueDiligenceFlags(latestAnswers);

    return NextResponse.json({
      lead: {
        id: lead.id,
        email: lead.email,
        stage: lead.stage,
      },
      personalDetails: {
        ...getPersonalDetails(latestAnswers),
        email: lead.email,
      },
      investorProfile: getInvestorProfile(latestAnswers),
      fundingSource: getFundingSource(latestAnswers),
      riskDeclarations: getRiskDeclarations(latestAnswers),
      paymentAccount: getPaymentAccount(latestAnswers),
      reviewSummary: {
        riskLevel: validation.riskLevel,
        requiresEnhancedReview: validation.requiresEnhancedReview,
        enhancedReviewFlags,
        missingAnswers: validation.missingAnswers,
        missingDocuments: validation.missingDocuments,
        recommendedMissingAnswers: validation.recommendedMissingAnswers,
        recommendedMissingDocuments: validation.recommendedMissingDocuments,
      },
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching admin KYC review data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KYC review data' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const session = await verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leadId } = params;
    const body = (await request.json()) as Record<string, unknown>;
    const decision = getStringValue(body.decision || body.action);
    const reason = getStringValue(body.reason);
    const approvedBy = session.email;

    if (!decision) {
      return NextResponse.json(
        { error: 'Decision is required' },
        { status: 400 }
      );
    }

    const lead = await getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.stage !== 'pending_human_review') {
      return NextResponse.json(
        { error: 'Lead is not pending KYC review' },
        { status: 400 }
      );
    }

    if (!lead.kyc_submitted_at) {
      return NextResponse.json(
        { error: 'Lead is pending team follow-up, not KYC review' },
        { status: 400 }
      );
    }

    if (decision === 'approved' || decision === 'approve') {
      const validation = await validateKycSubmission(leadId);

      if (!validation.valid) {
        return NextResponse.json(
          {
            error:
              'KYC package is still incomplete and cannot be approved yet.',
            missingAnswers: validation.missingAnswers,
            missingDocuments: validation.missingDocuments,
          },
          { status: 400 }
        );
      }

      await approveKYC(leadId, approvedBy);

      const firstMessageTimestamp = Math.floor(Date.now() / 1000);
      const textMessageId = nanoid();
      const pipelineMessageId = nanoid();
      const componentMessageId = nanoid();
      const pipelineStatusMetadata = JSON.stringify(
        createComponentMetadata(
          'pipeline_status',
          buildPipelineStatusData('agreement_pending')
        )
      );
      const agreementReadyMetadata = JSON.stringify({
        component: 'agreement_ready',
        data: {
          agreementUrl: `/agreement/${leadId}`,
          spvName: 'Akwa Ibom Hospitality SPV',
        },
      });

      await execute(
        `INSERT INTO messages (id, lead_id, role, content, metadata, created_at)
         VALUES (?, ?, 'agent', ?, NULL, ?)`,
        [
          textMessageId,
          leadId,
          'Great news — your identity has been verified by our compliance team. You are now cleared to review and sign your investment agreement.',
          firstMessageTimestamp,
        ]
      );
      await execute(
        `INSERT INTO messages (id, lead_id, role, content, metadata, created_at)
         VALUES (?, ?, 'agent', '', ?, ?)`,
        [
          pipelineMessageId,
          leadId,
          pipelineStatusMetadata,
          firstMessageTimestamp + 1,
        ]
      );
      await execute(
        `INSERT INTO messages (id, lead_id, role, content, metadata, created_at)
         VALUES (?, ?, 'agent', '', ?, ?)`,
        [
          componentMessageId,
          leadId,
          agreementReadyMetadata,
          firstMessageTimestamp + 2,
        ]
      );

      await logAuditEvent({
        leadId,
        eventType: 'kyc_approved',
        metadata: {
          approved_by: approvedBy,
          risk_level: validation.riskLevel,
        },
      });

      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
        new URL(request.url).origin;
      const agreementLink = buildInvestorAccessUrl(
        appUrl,
        lead.email,
        `/agreement/${leadId}`
      );
      const emailTemplate = getKYCApprovalEmailTemplate({
        investorName: lead.full_name || 'Investor',
        agreementLink,
      });

      try {
        await sendEmail({
          to: lead.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
        });
      } catch (emailError) {
        console.error('Failed to send approval email:', emailError);
      }

      return NextResponse.json({
        success: true,
        action: 'approved',
        leadId,
      });
    }

    if (decision === 'rejected' || decision === 'reject') {
      if (!reason) {
        return NextResponse.json(
          { error: 'Reason for rejection is required' },
          { status: 400 }
        );
      }

      try {
        await purgeStoredKycDocuments(leadId);
      } catch (error) {
        console.error('Failed to purge stored KYC documents on rejection:', error);
        return NextResponse.json(
          {
            error:
              'Failed to securely remove stored KYC documents. Please retry the rejection.',
          },
          { status: 502 }
        );
      }

      await returnKYCToIntake(leadId);

      await logAuditEvent({
        leadId,
        eventType: 'kyc_rejected',
        metadata: {
          rejected_by: approvedBy,
          reason,
        },
      });

      const emailTemplate = getKycRejectionEmailTemplate({
        investorName: lead.full_name || 'Investor',
        reason,
      });

      try {
        await sendEmail({
          to: lead.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
        });
      } catch (emailError) {
        console.error('Failed to send rejection email:', emailError);
      }

      return NextResponse.json({
        success: true,
        action: 'rejected',
        leadId,
      });
    }

    return NextResponse.json(
      { error: 'Invalid decision. Must be approved or rejected' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing KYC decision:', error);
    return NextResponse.json(
      { error: 'Failed to process KYC decision' },
      { status: 500 }
    );
  }
}
