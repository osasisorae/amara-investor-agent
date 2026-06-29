import { NextRequest, NextResponse } from 'next/server';
import { logAuditEvent } from '@/lib/db/audit';
import { query } from '@/lib/db/client';
import { getLeadById, deleteLeadCascade } from '@/lib/db/leads';
import { getRecentMessagesByLeadId } from '@/lib/db/messages';
import { verifyAdminSession } from '@/lib/admin-auth';

interface AuditEventRow {
  event_type: string;
  metadata?: string | null;
  created_at: number;
}

function parseMetadata(
  value?: string | null
): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

async function getHumanReviewState(leadId: string) {
  const auditEvents = await query<AuditEventRow>(
    `SELECT event_type, metadata, created_at
     FROM audit_events
     WHERE lead_id = ?
       AND event_type IN ('human_review_requested', 'human_review_resolved')
     ORDER BY created_at DESC`,
    [leadId]
  );

  const latestRequested = auditEvents.find(
    (event) => event.event_type === 'human_review_requested'
  );
  const latestResolved = auditEvents.find(
    (event) => event.event_type === 'human_review_resolved'
  );
  const requestMetadata = parseMetadata(latestRequested?.metadata);
  const resolvedMetadata = parseMetadata(latestResolved?.metadata);
  const open = Boolean(
    latestRequested &&
      (!latestResolved || latestResolved.created_at < latestRequested.created_at)
  );

  return {
    open,
    latestRequested,
    latestResolved,
    requestMetadata,
    resolvedMetadata,
  };
}

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

    const [reviewState, messages] = await Promise.all([
      getHumanReviewState(leadId),
      getRecentMessagesByLeadId(leadId, 25),
    ]);

    return NextResponse.json({
      lead: {
        id: lead.id,
        email: lead.email,
        fullName: lead.full_name || '',
        stage: lead.stage,
        country: lead.country || '',
      },
      reviewRequest: {
        open: reviewState.open,
        reason:
          reviewState.requestMetadata?.reason &&
          typeof reviewState.requestMetadata.reason === 'string'
            ? reviewState.requestMetadata.reason
            : null,
        requestedAt: reviewState.latestRequested?.created_at || null,
        resolvedAt: reviewState.latestResolved?.created_at || null,
        resolvedBy:
          reviewState.resolvedMetadata?.resolved_by &&
          typeof reviewState.resolvedMetadata.resolved_by === 'string'
            ? reviewState.resolvedMetadata.resolved_by
            : null,
      },
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching admin support review:', error);
    return NextResponse.json(
      { error: 'Failed to fetch follow-up review details' },
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
    const action =
      typeof body.action === 'string' ? body.action.trim() : '';

    if (action !== 'resolve_human_review') {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    const lead = await getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const reviewState = await getHumanReviewState(leadId);

    if (!reviewState.open) {
      return NextResponse.json(
        { error: 'No open follow-up request for this lead.' },
        { status: 400 }
      );
    }

    await logAuditEvent({
      leadId,
      eventType: 'human_review_resolved',
      metadata: {
        resolved_by: session.email,
        request_reason:
          reviewState.requestMetadata?.reason &&
          typeof reviewState.requestMetadata.reason === 'string'
            ? reviewState.requestMetadata.reason
            : null,
      },
    });

    return NextResponse.json({
      success: true,
      action: 'resolved_human_review',
    });
  } catch (error) {
    console.error('Error resolving admin support review:', error);
    return NextResponse.json(
      { error: 'Failed to resolve follow-up review' },
      { status: 500 }
    );
  }
}

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
