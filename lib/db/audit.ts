import { nanoid } from 'nanoid';
import { execute, query } from './client';

export type AuditEventType =
  | 'outreach_sent'
  | 'qualification_started'
  | 'qualification_passed'
  | 'qualification_failed'
  | 'future_interest_noted'
  | 'deal_room_accessed'
  | 'kyc_submitted'
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'agreement_viewed'
  | 'agreement_signed'
  | 'payment_instructions_sent';

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
  metadata?: Record<string, any>;
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
