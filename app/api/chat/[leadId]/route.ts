import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, updateLeadStage } from '@/lib/db/leads';
import { getMessagesByLeadId } from '@/lib/db/messages';
import { orchestrator } from '@/lib/agent/orchestrator';

export async function GET(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;

    const lead = await getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const messages = await getMessagesByLeadId(leadId);

    return NextResponse.json({
      lead,
      messages,
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;
    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const lead = await getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Process message through agent orchestrator
    const response = await orchestrator.processMessage(lead, message);

    // Update stage if needed
    if (response.shouldUpdateStage) {
      await updateLeadStage(leadId, response.shouldUpdateStage);
    }

    return NextResponse.json({
      message: response.message,
      stage: response.shouldUpdateStage || lead.stage,
      metadata: response.metadata,
    });
  } catch (error) {
    console.error('Error processing message:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}
