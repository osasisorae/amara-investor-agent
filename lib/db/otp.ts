import { randomInt } from 'node:crypto';
import { nanoid } from 'nanoid';
import { execute, queryOne } from './client';

export interface OtpCode {
  id: string;
  lead_id: string;
  code: string;
  purpose: string;
  expires_at: number;
  used: number;
  created_at: number;
}

function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export async function createOtpCode(params: {
  leadId: string;
  purpose: string;
  ttlMinutes?: number;
}): Promise<OtpCode> {
  const id = nanoid();
  const code = generateOtpCode();
  const now = Math.floor(Date.now() / 1000);
  const ttlMinutes = params.ttlMinutes ?? 10;
  const expiresAt = now + ttlMinutes * 60;

  await execute(
    'UPDATE otp_codes SET used = 1 WHERE lead_id = ? AND purpose = ? AND used = 0',
    [params.leadId, params.purpose]
  );

  await execute(
    `INSERT INTO otp_codes (id, lead_id, code, purpose, expires_at, used, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [id, params.leadId, code, params.purpose, expiresAt, now]
  );

  return {
    id,
    lead_id: params.leadId,
    code,
    purpose: params.purpose,
    expires_at: expiresAt,
    used: 0,
    created_at: now,
  };
}

export async function consumeOtpCode(params: {
  leadId: string;
  purpose: string;
  code: string;
}): Promise<OtpCode | null> {
  const now = Math.floor(Date.now() / 1000);
  const otp = await queryOne<OtpCode>(
    `SELECT *
     FROM otp_codes
     WHERE lead_id = ?
       AND purpose = ?
       AND code = ?
       AND used = 0
       AND expires_at >= ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [params.leadId, params.purpose, params.code, now]
  );

  if (!otp) {
    return null;
  }

  await execute('UPDATE otp_codes SET used = 1 WHERE id = ?', [otp.id]);
  return {
    ...otp,
    used: 1,
  };
}
