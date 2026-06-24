import { nanoid } from 'nanoid';
import { execute, query, queryOne } from './client';

export interface KycDocumentRow {
  id: string;
  lead_id: string;
  doc_type: string;
  file_url: string;
  file_name: string;
  file_size?: number | null;
  uploaded_at: number;
}

export interface KycDocument {
  id: string;
  leadId: string;
  docType: string;
  filename: string;
  fileSize?: number;
  uploadedAt: number;
}

function normalizeKycDocument(row: KycDocumentRow): KycDocument {
  return {
    id: row.id,
    leadId: row.lead_id,
    docType: row.doc_type,
    filename: row.file_name || row.file_url,
    fileSize:
      typeof row.file_size === 'number' ? Number(row.file_size) : undefined,
    uploadedAt: row.uploaded_at,
  };
}

export async function saveKycDocument(data: {
  leadId: string;
  docType: string;
  filename: string;
  fileSize?: number;
}): Promise<KycDocument> {
  const id = nanoid();
  const now = Math.floor(Date.now() / 1000);

  // The current schema still exposes legacy file_url/file_name columns.
  // We store only the private object key in both fields and never persist
  // a public URL.
  await execute(
    `INSERT INTO kyc_documents (id, lead_id, doc_type, file_url, file_name, file_size, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.leadId,
      data.docType,
      data.filename,
      data.filename,
      data.fileSize ?? null,
      now,
    ]
  );

  return {
    id,
    leadId: data.leadId,
    docType: data.docType,
    filename: data.filename,
    fileSize: data.fileSize,
    uploadedAt: now,
  };
}

export async function getKycDocumentsByLeadId(
  leadId: string
): Promise<KycDocument[]> {
  const rows = await query<KycDocumentRow>(
    `SELECT id, lead_id, doc_type, file_url, file_name, file_size, uploaded_at
     FROM kyc_documents
     WHERE lead_id = ?
     ORDER BY uploaded_at ASC`,
    [leadId]
  );

  return rows.map(normalizeKycDocument);
}

export async function deleteKycDocumentsByLeadId(leadId: string): Promise<void> {
  await execute('DELETE FROM kyc_documents WHERE lead_id = ?', [leadId]);
}

export async function getKycDocumentByFilename(
  leadId: string,
  filename: string
): Promise<KycDocument | null> {
  const row = await queryOne<KycDocumentRow>(
    `SELECT id, lead_id, doc_type, file_url, file_name, file_size, uploaded_at
     FROM kyc_documents
     WHERE lead_id = ?
       AND (file_name = ? OR file_url = ?)
     LIMIT 1`,
    [leadId, filename, filename]
  );

  return row ? normalizeKycDocument(row) : null;
}

export async function hasAuditEventForLead(
  leadId: string,
  eventType: string
): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT id
     FROM audit_events
     WHERE lead_id = ?
       AND event_type = ?
     LIMIT 1`,
    [leadId, eventType]
  );

  return Boolean(row);
}
