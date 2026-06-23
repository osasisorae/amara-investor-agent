import { NextRequest, NextResponse } from 'next/server';
import { logAuditEvent } from '@/lib/db/audit';
import { getLeadById, updateLeadStage } from '@/lib/db/leads';
import { verifyAdminSession } from '@/lib/admin-auth';

// Stage ownership rule: only lib/agent/orchestrator.ts and the admin KYC/payment
// endpoints may write leads.stage. This route owns payment confirmation changes.
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
    const confirmedBy = session.email;

    const lead = await getLeadById(leadId);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.stage !== 'payment_pending') {
      return NextResponse.json(
        { error: 'Lead is not awaiting payment confirmation' },
        { status: 400 }
      );
    }

    await updateLeadStage(leadId, 'closed');
    await logAuditEvent({
      leadId,
      eventType: 'payment_received',
      metadata: {
        confirmed_by: confirmedBy,
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      stage: 'closed',
    });
  } catch (error) {
    console.error('Error confirming payment:', error);
    return NextResponse.json(
      { error: 'Failed to confirm payment' },
      { status: 500 }
    );
  }
}
