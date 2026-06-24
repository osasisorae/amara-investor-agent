import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getKycDocumentsByLeadId } from '@/lib/db/kyc';
import { getLeadById } from '@/lib/db/leads';

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

    const documents = await getKycDocumentsByLeadId(leadId);

    return NextResponse.json({
      documents: documents.map((document) => ({
        id: document.id,
        docType: document.docType,
        filename: document.filename,
        uploadedAt: document.uploadedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching admin KYC documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KYC documents' },
      { status: 500 }
    );
  }
}
