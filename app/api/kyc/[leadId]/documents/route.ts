import { NextRequest, NextResponse } from 'next/server';
import {
  deleteKycDocumentById,
  getKycDocumentById,
  getKycDocumentsByLeadId,
} from '@/lib/db/kyc';
import { getLeadById } from '@/lib/db/leads';
import { verifyInvestorSession } from '@/lib/investor-auth';
import { deleteFile } from '@/lib/storage/r2';

function getStringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;
    const session = await verifyInvestorSession(request, leadId);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const documents = await getKycDocumentsByLeadId(leadId);

    return NextResponse.json({
      documents: documents.map((document) => ({
        id: document.id,
        doc_type: document.docType,
        filename: document.filename,
        uploaded_at: document.uploadedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching investor KYC documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KYC documents' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;
    const session = await verifyInvestorSession(request, leadId);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lead = await getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.stage !== 'kyc_intake') {
      return NextResponse.json(
        { error: 'Documents can only be removed during KYC intake' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const documentId = getStringValue(body.documentId);

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId is required' },
        { status: 400 }
      );
    }

    const document = await getKycDocumentById(leadId, documentId);
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    try {
      await deleteFile(document.filename);
    } catch (error) {
      console.error(
        'Failed to delete KYC document from R2 before removing metadata:',
        error
      );
    }

    await deleteKycDocumentById(leadId, documentId);

    return NextResponse.json({
      success: true,
      removed: {
        id: document.id,
        doc_type: document.docType,
        filename: document.filename,
      },
    });
  } catch (error) {
    console.error('Error removing investor KYC document:', error);
    return NextResponse.json(
      { error: 'Failed to remove KYC document' },
      { status: 500 }
    );
  }
}
