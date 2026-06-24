import { NextRequest, NextResponse } from 'next/server';
import { toChatMessages } from '@/lib/chat/messages';
import { getLeadById } from '@/lib/db/leads';
import { getMessagesByLeadId } from '@/lib/db/messages';
import { verifyInvestorSession } from '@/lib/investor-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;

    if (!(await verifyInvestorSession(request, leadId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lead = await getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const messages = await getMessagesByLeadId(leadId);

    return NextResponse.json({
      lead: {
        id: lead.id,
        stage: lead.stage,
        kyc_submitted_at: lead.kyc_submitted_at,
      },
      messages: toChatMessages(messages),
    });
  } catch (error) {
    console.error('Error polling chat messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat messages' },
      { status: 500 }
    );
  }
}
