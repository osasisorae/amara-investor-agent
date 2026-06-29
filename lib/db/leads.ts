import { nanoid } from 'nanoid';
import { db, query, queryOne, execute } from './client';
import { getKycDocumentsByLeadId } from './kyc';
import { deleteFile } from '@/lib/storage/r2';

export type LeadStage =
  | 'outreach_sent'
  | 'qualifying'
  | 'deal_room'
  | 'kyc_intake'
  | 'pending_human_review'
  | 'kyc_rejected'
  | 'agreement_pending'
  | 'agreement_signed'
  | 'payment_pending'
  | 'closed'
  | 'disqualified';

export interface Lead {
  id: string;
  email: string;
  stage: LeadStage;
  full_name?: string;
  phone?: string;
  country?: string;
  added_by: string;
  added_at: number;
  qualified_at?: number;
  kyc_submitted_at?: number;
  kyc_reviewed_at?: number;
  kyc_approved: number;
  approved_by?: string;
  agreement_viewed_at?: number;
  agreement_signed_at?: number;
  created_at: number;
  updated_at: number;
}

export async function createLead(data: {
  email: string;
  addedBy: string;
  fullName?: string;
}): Promise<Lead> {
  const id = nanoid();
  const now = Math.floor(Date.now() / 1000);
  const normalizedEmail = data.email.trim().toLowerCase();
  const normalizedFullName =
    typeof data.fullName === 'string' && data.fullName.trim().length > 0
      ? data.fullName.trim()
      : null;

  await execute(
    `INSERT INTO leads (id, email, stage, full_name, added_by, added_at, created_at, updated_at)
     VALUES (?, ?, 'outreach_sent', ?, ?, ?, ?, ?)`,
    [id, normalizedEmail, normalizedFullName, data.addedBy, now, now, now]
  );

  const lead = await queryOne<Lead>(
    'SELECT * FROM leads WHERE id = ?',
    [id]
  );

  if (!lead) {
    throw new Error('Failed to create lead');
  }

  return lead;
}

export async function getLeadById(id: string): Promise<Lead | null> {
  return queryOne<Lead>('SELECT * FROM leads WHERE id = ?', [id]);
}

export async function getLeadByEmail(email: string): Promise<Lead | null> {
  return queryOne<Lead>('SELECT * FROM leads WHERE email = ?', [
    email.trim().toLowerCase(),
  ]);
}

export async function deleteLeadCascade(
  leadId: string
): Promise<{ email: string } | null> {
  const lead = await queryOne<{ email: string }>(
    'SELECT email FROM leads WHERE id = ?',
    [leadId]
  );

  if (!lead) {
    return null;
  }

  const kycDocuments = await getKycDocumentsByLeadId(leadId);

  for (const document of kycDocuments) {
    await deleteFile(document.filename);
  }

  const transaction = await db.transaction('write');

  try {
    // Keep the explicit deletion order aligned with the admin recovery flow.
    await transaction.execute({
      sql: 'DELETE FROM audit_events WHERE lead_id = ?',
      args: [leadId],
    });
    await transaction.execute({
      sql: 'DELETE FROM qualification_answers WHERE lead_id = ?',
      args: [leadId],
    });
    await transaction.execute({
      sql: 'DELETE FROM kyc_documents WHERE lead_id = ?',
      args: [leadId],
    });
    await transaction.execute({
      sql: 'DELETE FROM messages WHERE lead_id = ?',
      args: [leadId],
    });
    await transaction.execute({
      sql: 'DELETE FROM otp_codes WHERE lead_id = ?',
      args: [leadId],
    });
    await transaction.execute({
      sql: 'DELETE FROM leads WHERE id = ?',
      args: [leadId],
    });
    await transaction.execute({
      sql: 'UPDATE offeree_register SET activated = 0 WHERE email = ?',
      args: [lead.email],
    });

    await transaction.commit();

    return lead;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch {
      // Ignore rollback errors so the original failure is preserved.
    }

    throw error;
  }
}

export async function getAllLeads(): Promise<Lead[]> {
  return query<Lead>('SELECT * FROM leads ORDER BY created_at DESC');
}

export async function getLeadsByStage(stage: LeadStage): Promise<Lead[]> {
  return query<Lead>(
    'SELECT * FROM leads WHERE stage = ? ORDER BY created_at DESC',
    [stage]
  );
}

export async function updateLeadStage(
  leadId: string,
  newStage: LeadStage
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await execute(
    'UPDATE leads SET stage = ?, updated_at = ? WHERE id = ?',
    [newStage, now, leadId]
  );
}

export async function updateLead(
  leadId: string,
  updates: Partial<Omit<Lead, 'id' | 'email' | 'created_at'>>
): Promise<void> {
  if (Object.keys(updates).length === 0) {
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const fields = Object.keys(updates)
    .map((key) => `${key} = ?`)
    .join(', ');
  const values = [...Object.values(updates), now, leadId];

  await execute(
    `UPDATE leads SET ${fields}, updated_at = ? WHERE id = ?`,
    values
  );
}

export async function markKYCSubmitted(leadId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await execute(
    `UPDATE leads SET 
      kyc_submitted_at = ?,
      updated_at = ?
     WHERE id = ?`,
    [now, now, leadId]
  );
}

export async function approveKYC(
  leadId: string,
  approvedBy: string
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await execute(
    `UPDATE leads SET 
      kyc_approved = 1,
      kyc_reviewed_at = ?,
      approved_by = ?,
      stage = 'agreement_pending',
      updated_at = ?
     WHERE id = ?`,
    [now, approvedBy, now, leadId]
  );
}

export async function rejectKYC(leadId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await execute(
    `UPDATE leads SET 
      kyc_approved = 0,
      kyc_reviewed_at = ?,
      stage = 'kyc_rejected',
      updated_at = ?
     WHERE id = ?`,
    [now, now, leadId]
  );
}

export async function returnKYCToIntake(leadId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await execute(
    `UPDATE leads SET
      kyc_approved = 0,
      kyc_submitted_at = NULL,
      kyc_reviewed_at = ?,
      approved_by = NULL,
      stage = 'kyc_intake',
      updated_at = ?
     WHERE id = ?`,
    [now, now, leadId]
  );
}

export async function markLeadQualified(leadId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await execute(
    `UPDATE leads SET
      qualified_at = COALESCE(qualified_at, ?),
      updated_at = ?
     WHERE id = ?`,
    [now, now, leadId]
  );
}

export async function markAgreementViewed(leadId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await execute(
    `UPDATE leads SET
      agreement_viewed_at = COALESCE(agreement_viewed_at, ?),
      updated_at = ?
     WHERE id = ?`,
    [now, now, leadId]
  );
}

export async function markAgreementSigned(leadId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await execute(
    `UPDATE leads SET
      agreement_signed_at = COALESCE(agreement_signed_at, ?),
      updated_at = ?
     WHERE id = ?`,
    [now, now, leadId]
  );
}
