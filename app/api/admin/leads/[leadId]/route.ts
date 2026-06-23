import { NextRequest, NextResponse } from 'next/server';
import { deleteLeadCascade } from '@/lib/db/leads';
import { verifyAdminSession } from '@/lib/admin-auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const session = await verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leadId } = params;

    const lead = await deleteLeadCascade(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Lead and all associated data deleted. Offeree reset for re-add.',
      email: lead.email,
    });
  } catch (error) {
    console.error('Error deleting lead:', error);
    return NextResponse.json(
      { error: 'Failed to delete lead' },
      { status: 500 }
    );
  }
}
