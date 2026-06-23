import { NextRequest, NextResponse } from 'next/server';
import { logAuditEvent } from '@/lib/db/audit';
import { getLeadById, updateLeadStage } from '@/lib/db/leads';

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;
    const body = await request.json();
    const confirmedBy =
      typeof body.confirmedBy === 'string' ? body.confirmedBy.trim() : '';

    if (!confirmedBy) {
      return NextResponse.json(
        { error: 'confirmedBy is required' },
        { status: 400 }
      );
    }

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
