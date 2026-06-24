import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { logAuditEvent } from '@/lib/db/audit';
import { getKycDocumentsByLeadId, deleteKycDocumentsByLeadId } from '@/lib/db/kyc';
import {
  approveKYC,
  getLeadById,
  returnKYCToIntake,
} from '@/lib/db/leads';
import { getRecentMessagesByLeadId } from '@/lib/db/messages';
import { getLatestQualificationAnswerMap } from '@/lib/db/qualification';
import { sendEmail } from '@/lib/email/resend-client';
import {
  getKYCApprovalEmailTemplate,
  getKycRejectionEmailTemplate,
} from '@/lib/email/templates';

function getStringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getPersonalDetails(
  answers: Record<string, { answer: string }>
): {
  fullLegalName: string;
  dateOfBirth: string;
  nationality: string;
  countryOfResidence: string;
  phoneNumber: string;
} {
  return {
    fullLegalName: answers.full_legal_name?.answer || '',
    dateOfBirth: answers.date_of_birth?.answer || '',
    nationality: answers.nationality?.answer || '',
    countryOfResidence: answers.country_of_residence?.answer || '',
    phoneNumber: answers.phone_number?.answer || '',
  };
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

    const [documents, latestAnswers, messages] = await Promise.all([
      getKycDocumentsByLeadId(leadId),
      getLatestQualificationAnswerMap(leadId),
      getRecentMessagesByLeadId(leadId, 10),
    ]);

    return NextResponse.json({
      lead: {
        id: lead.id,
        email: lead.email,
        stage: lead.stage,
      },
      personalDetails: {
        ...getPersonalDetails(
          latestAnswers as Record<string, { answer: string }>
        ),
        email: lead.email,
      },
      documents: documents.map((document) => ({
        docType: document.docType,
        filename: document.filename,
        uploadedAt: document.uploadedAt,
      })),
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
      await approveKYC(leadId, approvedBy);

      await logAuditEvent({
        leadId,
        eventType: 'kyc_approved',
        metadata: { approved_by: approvedBy },
      });

      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
        new URL(request.url).origin;
      const agreementLink = `${appUrl}/agreement/${leadId}`;
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

      await returnKYCToIntake(leadId);
      await deleteKycDocumentsByLeadId(leadId);

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
