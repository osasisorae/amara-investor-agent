import { NextRequest, NextResponse } from 'next/server';
import { mapAdminReviewMessage } from '@/lib/admin/chat-review';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getLeadById } from '@/lib/db/leads';
import { getMessagesByLeadId } from '@/lib/db/messages';

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

    const messages = await getMessagesByLeadId(leadId);

    return NextResponse.json({
      lead: {
        id: lead.id,
        email: lead.email,
        fullName: lead.full_name || '',
        stage: lead.stage,
      },
      transcript: messages.map(mapAdminReviewMessage),
    });
  } catch (error) {
    console.error('Error fetching admin transcript review:', error);
    return NextResponse.json(
      { error: 'Failed to load transcript' },
      { status: 500 }
    );
  }
}
