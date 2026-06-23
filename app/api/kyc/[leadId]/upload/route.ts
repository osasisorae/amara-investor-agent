import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { nanoid } from 'nanoid';
import {
  buildPipelineStatusData,
  createComponentMetadata,
  getComponentFallbackText,
} from '@/lib/chat/components';
import { applyOrchestratorStageTransition } from '@/lib/agent/orchestrator';
import { toChatMessages } from '@/lib/chat/messages';
import { getLeadById, markKYCSubmitted } from '@/lib/db/leads';
import { execute, queryOne } from '@/lib/db/client';
import { logAuditEvent } from '@/lib/db/audit';
import { saveMessage } from '@/lib/db/messages';

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;
    const formData = await request.formData();

    const lead = await getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.stage !== 'kyc_intake') {
      return NextResponse.json(
        { error: 'Lead is not in KYC intake stage' },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File;
    const docType = formData.get('docType') as string;

    if (!file || !docType) {
      return NextResponse.json(
        { error: 'File and document type are required' },
        { status: 400 }
      );
    }

    // For demo: if no Vercel Blob token, store as placeholder
    let fileUrl = '';
    
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      // Upload to Vercel Blob
      const blob = await put(`kyc/${leadId}/${nanoid()}-${file.name}`, file, {
        access: 'public',
      });
      fileUrl = blob.url;
    } else {
      // Demo mode: generate placeholder URL
      fileUrl = `/demo/kyc/${leadId}/${file.name}`;
    }

    // Save document metadata to database
    const docId = nanoid();
    const now = Math.floor(Date.now() / 1000);

    await execute(
      `INSERT INTO kyc_documents (id, lead_id, doc_type, file_url, file_name, file_size, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [docId, leadId, docType, fileUrl, file.name, file.size, now]
    );

    // Log audit event
    await logAuditEvent({
      leadId,
      eventType: 'kyc_submitted',
      metadata: {
        doc_type: docType,
        file_name: file.name,
        file_size: file.size,
      },
    });

    return NextResponse.json({
      success: true,
      documentId: docId,
      fileUrl,
    });
  } catch (error) {
    console.error('Error uploading KYC document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}

// Mark KYC as complete and move to pending review
export async function PATCH(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;

    const lead = await getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.stage !== 'kyc_intake') {
      return NextResponse.json(
        { error: 'Lead is not in KYC intake stage' },
        { status: 400 }
      );
    }

    const uploadedCount = await queryOne<{ total: number }>(
      'SELECT COUNT(*) as total FROM kyc_documents WHERE lead_id = ?',
      [leadId]
    );

    if (!uploadedCount || Number(uploadedCount.total) < 2) {
      return NextResponse.json(
        { error: 'At least two KYC documents are required before submission' },
        { status: 400 }
      );
    }

    // Mark as submitted and move to pending review
    await markKYCSubmitted(leadId);
    await applyOrchestratorStageTransition(leadId, 'pending_human_review');

    // Log audit event
    await logAuditEvent({
      leadId,
      eventType: 'kyc_submitted',
      metadata: { status: 'pending_human_review' },
    });

    const agentMessages = [
      await saveMessage({
        leadId,
        role: 'agent',
        content:
          'Thanks. Your documents are now with our compliance team for review. I’ll keep you posted as soon as there is an update.',
      }),
      await saveMessage({
        leadId,
        role: 'agent',
        content: getComponentFallbackText('pipeline_status'),
        metadata: createComponentMetadata(
          'pipeline_status',
          buildPipelineStatusData('pending_human_review')
        ) as unknown as Record<string, unknown>,
      }),
    ];

    return NextResponse.json({
      success: true,
      stage: 'pending_human_review',
      message: 'KYC submitted for review',
      messages: toChatMessages(agentMessages),
    });
  } catch (error) {
    console.error('Error completing KYC submission:', error);
    return NextResponse.json(
      { error: 'Failed to complete KYC submission' },
      { status: 500 }
    );
  }
}
