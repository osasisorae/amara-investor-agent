import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, approveKYC, rejectKYC } from '@/lib/db/leads';
import { logAuditEvent } from '@/lib/db/audit';
import { sendEmail } from '@/lib/email/resend-client';
import { getKYCApprovalEmailTemplate } from '@/lib/email/templates';
import { verifyAdminSession } from '@/lib/admin-auth';

// Stage ownership rule: only lib/agent/orchestrator.ts and the admin KYC/payment
// endpoints may write leads.stage. This route owns admin KYC approve/reject changes.
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
    const body = await request.json();
    const action = typeof body.action === 'string' ? body.action.trim() : '';
    const approvedBy = session.email;

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
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
