import { nanoid } from 'nanoid';
import { query, queryOne, execute } from './client';

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
}): Promise<Lead> {
  const id = nanoid();
  const now = Math.floor(Date.now() / 1000);

  await execute(
    `INSERT INTO leads (id, email, stage, added_by, added_at, created_at, updated_at)
     VALUES (?, ?, 'outreach_sent', ?, ?, ?, ?)`,
    [id, data.email, data.addedBy, now, now, now]
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
  return queryOne<Lead>('SELECT * FROM leads WHERE email = ?', [email]);
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
      stage = 'pending_human_review', 
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
