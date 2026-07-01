import { createHmac, randomInt } from 'node:crypto';
import { nanoid } from 'nanoid';
import { getRequiredJwtSecret } from '@/lib/security/env';
import { execute, queryOne } from './client';

const OTP_HASH_SECRET = getRequiredJwtSecret('INVESTOR_JWT_SECRET');

export interface OtpCode {
  id: string;
  lead_id: string;
  code: string;
  purpose: string;
  expires_at: number;
  used: number;
  created_at: number;
}

interface OtpSendStatsRow {
  latest_created_at: number | string | null;
  recent_count: number | string | null;
}

function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function getOtpHashSecret(): string {
  return OTP_HASH_SECRET;
}

function hashOtpCode(code: string): string {
  return `v1:${createHmac('sha256', getOtpHashSecret())
    .update(code)
    .digest('hex')}`;
}

export async function createOtpCode(params: {
  leadId: string;
  purpose: string;
  ttlMinutes?: number;
}): Promise<OtpCode> {
  const id = nanoid();
  const code = generateOtpCode();
  const hashedCode = hashOtpCode(code);
  const now = Math.floor(Date.now() / 1000);
  const ttlMinutes = params.ttlMinutes ?? 5;
  const expiresAt = now + ttlMinutes * 60;

  await execute(
    'UPDATE otp_codes SET used = 1 WHERE lead_id = ? AND purpose = ? AND used = 0',
    [params.leadId, params.purpose]
  );

  await execute(
    `INSERT INTO otp_codes (id, lead_id, code, purpose, expires_at, used, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [id, params.leadId, hashedCode, params.purpose, expiresAt, now]
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
  const hashedCode = hashOtpCode(params.code);
  const otp = await queryOne<OtpCode>(
    `SELECT *
     FROM otp_codes
     WHERE lead_id = ?
       AND purpose = ?
       AND code IN (?, ?)
       AND used = 0
       AND expires_at >= ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [params.leadId, params.purpose, hashedCode, params.code, now]
  );

  if (!otp) {
    return null;
  }

  await execute('UPDATE otp_codes SET used = 1 WHERE id = ?', [otp.id]);
  return {
    ...otp,
    code: params.code,
    used: 1,
  };
}

export async function getOtpSendLimitStatus(params: {
  leadId: string;
  purpose: string;
  cooldownSeconds: number;
  windowSeconds: number;
  maxCodesPerWindow: number;
}): Promise<{
  allowed: boolean;
  retryAfterSeconds: number;
  reason?: 'cooldown' | 'window_limit';
}> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - params.windowSeconds;
  const row = await queryOne<OtpSendStatsRow>(
    `SELECT
       MAX(created_at) AS latest_created_at,
       COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS recent_count
     FROM otp_codes
     WHERE lead_id = ?
       AND purpose = ?`,
    [windowStart, params.leadId, params.purpose]
  );

  const latestCreatedAt =
    typeof row?.latest_created_at === 'number'
      ? row.latest_created_at
      : typeof row?.latest_created_at === 'string'
        ? Number(row.latest_created_at)
        : null;
  const recentCountValue = row?.recent_count;
  const recentCount =
    typeof recentCountValue === 'number'
      ? recentCountValue
      : typeof recentCountValue === 'string'
        ? Number(recentCountValue)
        : 0;

  if (
    latestCreatedAt &&
    now - latestCreatedAt < params.cooldownSeconds
  ) {
    return {
      allowed: false,
      retryAfterSeconds: params.cooldownSeconds - (now - latestCreatedAt),
      reason: 'cooldown',
    };
  }

  if (recentCount >= params.maxCodesPerWindow) {
    return {
      allowed: false,
      retryAfterSeconds: params.windowSeconds,
      reason: 'window_limit',
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}
