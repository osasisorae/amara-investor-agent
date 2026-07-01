import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { getLeadById } from '@/lib/db/leads';
import { logAuditEvent } from '@/lib/db/audit';
import { hasAuditEventForLead, saveKycDocument } from '@/lib/db/kyc';
import { getLatestQualificationAnswerMap } from '@/lib/db/qualification';
import { orchestrator } from '@/lib/agent/orchestrator';
import { toChatMessages } from '@/lib/chat/messages';
import {
  buildStoredKycDocType,
  normalizeKycDocumentType,
  type KycUploadSlot,
} from '@/lib/kyc/config';
import {
  getRequiredAdditionalKycDocTypes,
  isKycAdditionalDocumentType,
  isKycSourceOfFundsType,
} from '@/lib/kyc/requirements';
import { getR2ConfigStatus, uploadFile } from '@/lib/storage/r2';
import { verifyInvestorSession } from '@/lib/investor-auth';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['jpg', 'png', 'pdf']);
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
]);

type AllowedFileExtension = 'jpg' | 'png' | 'pdf';

const JPEG_MAGIC_BYTES = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_MAGIC_BYTES = Buffer.from([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
]);
const PDF_MAGIC_BYTES = Buffer.from('%PDF-');

function getFileExtension(file: File): AllowedFileExtension | null {
  const extensionFromName = file.name.split('.').pop()?.toLowerCase();
  const normalizedExtension =
    extensionFromName === 'jpeg' ? 'jpg' : extensionFromName;

  if (
    normalizedExtension &&
    ALLOWED_EXTENSIONS.has(normalizedExtension)
  ) {
    return normalizedExtension as AllowedFileExtension;
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

function getContentType(extension: AllowedFileExtension): string {
  switch (extension) {
    case 'jpg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

function detectFileSignature(buffer: Buffer): AllowedFileExtension | null {
  if (buffer.length >= JPEG_MAGIC_BYTES.length) {
    const jpegHeader = buffer.subarray(0, JPEG_MAGIC_BYTES.length);

    if (jpegHeader.equals(JPEG_MAGIC_BYTES)) {
      return 'jpg';
    }
  }

  if (buffer.length >= PNG_MAGIC_BYTES.length) {
    const pngHeader = buffer.subarray(0, PNG_MAGIC_BYTES.length);

    if (pngHeader.equals(PNG_MAGIC_BYTES)) {
      return 'png';
    }
  }

  if (buffer.length >= PDF_MAGIC_BYTES.length) {
    const pdfHeader = buffer.subarray(0, PDF_MAGIC_BYTES.length);

    if (pdfHeader.equals(PDF_MAGIC_BYTES)) {
      return 'pdf';
    }
  }

  return null;
}

function isMimeTypeCompatible(
  fileType: AllowedFileExtension,
  mimeType: string
): boolean {
  if (!mimeType) {
    return true;
  }

  switch (fileType) {
    case 'jpg':
      return mimeType === 'image/jpeg';
    case 'png':
      return mimeType === 'image/png';
    case 'pdf':
      return mimeType === 'application/pdf';
    default:
      return false;
  }
}

function sanitizeDocType(
  value: FormDataEntryValue | null
): KycUploadSlot | string | null {
  if (typeof value !== 'string') {
    return null;
  }

  if (
    value === 'document_front' ||
    value === 'document_back' ||
    value === 'proof_of_address'
  ) {
    return value;
  }

  return isKycAdditionalDocumentType(value) ? value : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const { leadId } = params;

  try {
    if (!(await verifyInvestorSession(request, leadId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const r2Config = getR2ConfigStatus();
    if (r2Config.missing.length > 0) {
      console.error('[KYC Upload] Document storage is unavailable.');
      return NextResponse.json(
        { error: 'Document upload is temporarily unavailable.' },
        { status: 503 }
      );
    }

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

    const hasConsent = await hasAuditEventForLead(leadId, 'kyc_consent_given');
    if (!hasConsent) {
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

    if (!(fileEntry instanceof File) || !docType) {
      return NextResponse.json(
        { error: 'File and valid document type are required' },
        { status: 400 }
      );
    }

    if (docType.startsWith('document_') && !selectedDocumentType) {
      return NextResponse.json(
        { error: 'A government ID type must be selected first' },
        { status: 400 }
      );
    }

    if (isKycAdditionalDocumentType(docType)) {
      const latestAnswers = await getLatestQualificationAnswerMap(leadId);
      const sourceOfFundsType = latestAnswers.source_of_funds_type?.answer?.trim();

      if (!sourceOfFundsType || !isKycSourceOfFundsType(sourceOfFundsType)) {
        return NextResponse.json(
          {
            error:
              'Funding source details must be recorded before supporting funds evidence can be uploaded.',
          },
          { status: 400 }
        );
      }

      const allowedAdditionalDocTypes =
        getRequiredAdditionalKycDocTypes(sourceOfFundsType);

      if (!allowedAdditionalDocTypes.includes(docType)) {
        return NextResponse.json(
          {
            error:
              'That document is not part of the current source of funds checklist. Refresh the chat and follow the latest KYC step.',
          },
          { status: 400 }
        );
      }
    }

    if (fileEntry.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Files must be 5MB or smaller' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    const extension = getFileExtension(fileEntry);
    const detectedFileType = detectFileSignature(buffer);
    if (
      !extension ||
      !detectedFileType ||
      extension !== detectedFileType ||
      (fileEntry.type && !ALLOWED_MIME_TYPES.has(fileEntry.type)) ||
      !isMimeTypeCompatible(detectedFileType, fileEntry.type)
    ) {
      return NextResponse.json(
        {
          error:
            'Only valid JPG, PNG, and PDF files with matching file signatures are allowed',
        },
        { status: 400 }
      );
    }

    const isIdentitySlot =
      docType === 'document_front' || docType === 'document_back';
    const storedDocType =
      isIdentitySlot && selectedDocumentType
        ? buildStoredKycDocType(selectedDocumentType, docType)
        : docType;
    const timestamp = Date.now();
    const filename = `${leadId}-${storedDocType}-${timestamp}.${detectedFileType}`;
    const contentType = getContentType(detectedFileType);

    const storedFilename = await uploadFile(buffer, filename, contentType);

    const document = await saveKycDocument({
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

    return NextResponse.json({
      filename: storedFilename,
      document: {
        id: document.id,
        doc_type: document.docType,
        filename: document.filename,
        uploaded_at: document.uploadedAt,
      },
    });
  } catch (error) {
    console.error(
      '[KYC Upload] Upload failed.',
      error instanceof Error ? { name: error.name } : undefined
    );

    return NextResponse.json(
      { error: 'Failed to upload document' },
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
    if (!(await verifyInvestorSession(request, leadId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const response = await orchestrator.processMessage(
      lead,
      'Payment account submitted',
      {
        appUrl,
      }
    );
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
