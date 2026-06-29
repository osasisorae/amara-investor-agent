import { nanoid } from 'nanoid';
import { execute, query, queryOne } from './client';

export type AuditEventType =
  | 'outreach_sent'
  | 'qualification_started'
  | 'qualification_passed'
  | 'qualification_failed'
  | 'future_interest_noted'
  | 'deal_room_email_sent'
  | 'deal_room_accessed'
  | 'human_review_requested'
  | 'human_review_resolved'
  | 'kyc_consent_given'
  | 'kyc_personal_details_submitted'
  | 'kyc_investor_profile_submitted'
  | 'kyc_funding_source_submitted'
  | 'kyc_risk_declarations_submitted'
  | 'kyc_payment_account_submitted'
  | 'kyc_document_uploaded'
  | 'kyc_enhanced_review_flagged'
  | 'kyc_submitted'
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'agreement_viewed'
  | 'agreement_signed'
  | 'otp_sent'
  | 'chat_access_otp_verification_failed'
  | 'agreement_otp_verification_failed'
  | 'payment_instructions_sent'
  | 'payment_confirmation_sent'
  | 'payment_received';

export interface AuditEvent {
  id: string;
  lead_id: string;
  event_type: AuditEventType;
  metadata?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: number;
}

export async function logAuditEvent(data: {
  leadId: string;
  eventType: AuditEventType;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const id = nanoid();
  const now = Math.floor(Date.now() / 1000);
  const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;

  await execute(
    `INSERT INTO audit_events (id, lead_id, event_type, metadata, ip_address, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.leadId,
      data.eventType,
      metadataJson,
      data.ipAddress || null,
      data.userAgent || null,
      now,
    ]
  );
}

export async function getAuditTrail(leadId: string): Promise<AuditEvent[]> {
  return query<AuditEvent>(
    'SELECT * FROM audit_events WHERE lead_id = ? ORDER BY created_at ASC',
    [leadId]
  );
}

export async function getAuditEventsByType(
  eventType: AuditEventType
): Promise<AuditEvent[]> {
  return query<AuditEvent>(
    'SELECT * FROM audit_events WHERE event_type = ? ORDER BY created_at DESC',
    [eventType]
  );
}

export async function countAuditEventsSince(params: {
  leadId: string;
  eventType: AuditEventType;
  since: number;
}): Promise<number> {
  const row = await queryOne<{ count: number | string }>(
    `SELECT COUNT(*) AS count
     FROM audit_events
     WHERE lead_id = ?
       AND event_type = ?
       AND created_at >= ?`,
    [params.leadId, params.eventType, params.since]
  );

  const countValue = row?.count;
  const parsedCount =
    typeof countValue === 'number'
      ? countValue
      : typeof countValue === 'string'
        ? Number(countValue)
        : 0;

  return Number.isFinite(parsedCount) ? parsedCount : 0;
}
