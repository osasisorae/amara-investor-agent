import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, approveKYC, rejectKYC } from '@/lib/db/leads';
import { logAuditEvent } from '@/lib/db/audit';
import { sendEmail } from '@/lib/email/resend-client';
import { getKYCApprovalEmailTemplate } from '@/lib/email/templates';

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;
    const { action, approvedBy } = await request.json();

    if (!action || !approvedBy) {
      return NextResponse.json(
        { error: 'Action and approvedBy are required' },
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

    if (action === 'approve') {
      // Approve KYC
      await approveKYC(leadId, approvedBy);

      // Log audit event
      await logAuditEvent({
        leadId,
        eventType: 'kyc_approved',
        metadata: { approved_by: approvedBy },
      });

      // Send approval email with agreement link
      const agreementLink = `${process.env.NEXT_PUBLIC_APP_URL}/chat/${leadId}`;
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
    } else if (action === 'reject') {
      // Reject KYC
      await rejectKYC(leadId);

      // Log audit event
      await logAuditEvent({
        leadId,
        eventType: 'kyc_rejected',
        metadata: { rejected_by: approvedBy },
      });

      return NextResponse.json({
        success: true,
        action: 'rejected',
        leadId,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be approve or reject' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error processing KYC decision:', error);
    return NextResponse.json(
      { error: 'Failed to process KYC decision' },
      { status: 500 }
    );
  }
}
