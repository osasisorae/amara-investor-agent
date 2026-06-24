import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getKycDocumentByFilename } from '@/lib/db/kyc';
import { getSignedDocumentUrl } from '@/lib/storage/r2';

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
    const filename = request.nextUrl.searchParams.get('filename')?.trim();

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    const document = await getKycDocumentByFilename(leadId, filename);
    if (!document) {
      return NextResponse.json(
        { error: 'Document not found for this lead' },
        { status: 404 }
      );
    }

    const url = await getSignedDocumentUrl(document.filename);

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error generating signed KYC document URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate document URL' },
      { status: 500 }
    );
  }
}
