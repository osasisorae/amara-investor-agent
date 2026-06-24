import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { getLeadById } from '@/lib/db/leads';
import { logAuditEvent } from '@/lib/db/audit';
import { hasAuditEventForLead, saveKycDocument } from '@/lib/db/kyc';
import { orchestrator } from '@/lib/agent/orchestrator';
import { toChatMessages } from '@/lib/chat/messages';
import {
  buildStoredKycDocType,
  normalizeKycDocumentType,
  type KycUploadSlot,
} from '@/lib/kyc/config';
import { uploadFile } from '@/lib/storage/r2';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'pdf']);
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
]);
const ALLOWED_DOC_TYPES = new Set<KycUploadSlot>([
  'document_front',
  'document_back',
  'proof_of_address',
  'source_of_funds',
]);

function getFileExtension(file: File): string | null {
  const extensionFromName = file.name.split('.').pop()?.toLowerCase();
  if (extensionFromName && ALLOWED_EXTENSIONS.has(extensionFromName)) {
    return extensionFromName;
  }

  switch (file.type) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'application/pdf':
      return 'pdf';
    default:
      return null;
  }
}

function getContentType(extension: string): string {
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

function sanitizeDocType(value: FormDataEntryValue | null): KycUploadSlot | null {
  if (typeof value !== 'string') {
    return null;
  }

  return ALLOWED_DOC_TYPES.has(value as KycUploadSlot)
    ? (value as KycUploadSlot)
    : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const { leadId } = params;
  
  try {
    console.log('[KYC Upload] Starting upload for lead:', leadId);
    
    const lead = await getLeadById(leadId);

    if (!lead) {
      console.log('[KYC Upload] Lead not found:', leadId);
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.stage !== 'kyc_intake') {
      console.log('[KYC Upload] Invalid stage:', lead.stage);
      return NextResponse.json(
        { error: 'Lead is not in KYC intake stage' },
        { status: 400 }
      );
    }

    const hasConsent = await hasAuditEventForLead(leadId, 'kyc_consent_given');
    if (!hasConsent) {
      console.log('[KYC Upload] No consent found for lead:', leadId);
      return NextResponse.json(
        { error: 'Consent must be recorded before document upload' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const fileEntry = formData.get('file');
    const docType = sanitizeDocType(formData.get('docType'));
    const selectedDocumentType = normalizeKycDocumentType(
      typeof formData.get('documentType') === 'string'
        ? String(formData.get('documentType'))
        : ''
    );

    console.log('[KYC Upload] docType:', docType, 'selectedDocumentType:', selectedDocumentType);

    if (!(fileEntry instanceof File) || !docType) {
      console.log('[KYC Upload] Invalid file or docType');
      return NextResponse.json(
        { error: 'File and valid document type are required' },
        { status: 400 }
      );
    }

    if (docType.startsWith('document_') && !selectedDocumentType) {
      console.log('[KYC Upload] Missing document type selection');
      return NextResponse.json(
        { error: 'A government ID type must be selected first' },
        { status: 400 }
      );
    }

    if (fileEntry.size > MAX_FILE_SIZE_BYTES) {
      console.log('[KYC Upload] File too large:', fileEntry.size);
      return NextResponse.json(
        { error: 'Files must be 5MB or smaller' },
        { status: 400 }
      );
    }

    const extension = getFileExtension(fileEntry);
    if (
      !extension ||
      (fileEntry.type && !ALLOWED_MIME_TYPES.has(fileEntry.type))
    ) {
      console.log('[KYC Upload] Invalid file type:', fileEntry.type, extension);
      return NextResponse.json(
        { error: 'Only JPG, JPEG, PNG, and PDF files are allowed' },
        { status: 400 }
      );
    }

    const storedDocType = docType.startsWith('document_') && selectedDocumentType
      ? buildStoredKycDocType(selectedDocumentType, docType)
      : docType;
    const timestamp = Date.now();
    const filename = `${leadId}-${storedDocType}-${timestamp}.${extension}`;
    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    const contentType = fileEntry.type || getContentType(extension);

    console.log('[KYC Upload] Uploading to R2:', filename);
    console.log('[KYC Upload] R2 Config check - Endpoint:', process.env.R2_ENDPOINT ? 'SET' : 'MISSING');
    console.log('[KYC Upload] R2 Config check - Access Key:', process.env.R2_ACCESS_KEY_ID ? 'SET' : 'MISSING');
    console.log('[KYC Upload] R2 Config check - Secret:', process.env.R2_SECRET_ACCESS_KEY ? 'SET' : 'MISSING');
    console.log('[KYC Upload] R2 Config check - Bucket:', process.env.R2_BUCKET_NAME ? 'SET' : 'MISSING');

    const storedFilename = await uploadFile(buffer, filename, contentType);
    console.log('[KYC Upload] Successfully uploaded:', storedFilename);

    await saveKycDocument({
      leadId,
      docType: storedDocType,
      filename: storedFilename,
      fileSize: fileEntry.size,
    });

    await logAuditEvent({
      leadId,
      eventType: 'kyc_document_uploaded',
      metadata: {
        docType: storedDocType,
        filename: storedFilename,
      },
    });

    console.log('[KYC Upload] Complete for lead:', leadId);
    return NextResponse.json({
      filename: storedFilename,
    });
  } catch (error) {
    console.error('[KYC Upload] Error uploading KYC document for lead:', leadId);
    console.error('[KYC Upload] Error details:', error);
    console.error('[KYC Upload] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return NextResponse.json(
      { 
        error: 'Failed to upload document',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

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

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
      new URL(request.url).origin;
    const response = await orchestrator.processMessage(lead, 'All documents uploaded', {
      appUrl,
    });
    const updatedLead = (await getLeadById(leadId)) || lead;

    return NextResponse.json({
      success: true,
      stage: updatedLead.stage,
      messages: toChatMessages(response.agentMessages),
    });
  } catch (error) {
    console.error('Error completing KYC submission:', error);
    return NextResponse.json(
      { error: 'Failed to complete KYC submission' },
      { status: 500 }
    );
  }
}
