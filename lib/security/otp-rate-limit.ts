import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';

interface SlidingWindowRateLimitParams {
  key: string;
  maxAttempts: number;
  windowSeconds: number;
}

interface SlidingWindowRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

type RateLimitStore = Map<string, number[]>;

const globalRateLimitStore = globalThis as typeof globalThis & {
  __futurexOtpRateLimitStore?: RateLimitStore;
};

const rateLimitStore: RateLimitStore =
  globalRateLimitStore.__futurexOtpRateLimitStore ??
  (globalRateLimitStore.__futurexOtpRateLimitStore = new Map());

function hashKeyPart(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function getNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function pruneTimestamps(
  timestamps: number[],
  windowStart: number
): number[] {
  return timestamps.filter((timestamp) => timestamp >= windowStart);
}

export function getClientIpAddress(
  request: Pick<NextRequest, 'headers'>
): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const firstHop = forwardedFor?.split(',')[0]?.trim();

  return firstHop || 'unknown';
}

export function buildOtpRateLimitKey(params: {
  scope: string;
  ipAddress: string;
  identifier?: string;
}): string {
  const parts = [params.scope, hashKeyPart(params.ipAddress)];

  if (params.identifier) {
    parts.push(hashKeyPart(params.identifier));
  }

  return parts.join(':');
}

export function consumeSlidingWindowRateLimit(
  params: SlidingWindowRateLimitParams
): SlidingWindowRateLimitResult {
  const now = getNowSeconds();
  const windowStart = now - params.windowSeconds;
  const existing = rateLimitStore.get(params.key) || [];
  const recentAttempts = pruneTimestamps(existing, windowStart);

  if (recentAttempts.length >= params.maxAttempts) {
    const oldestAttempt = recentAttempts[0];

    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        params.windowSeconds - (now - oldestAttempt)
      ),
    };
  }

  recentAttempts.push(now);
  rateLimitStore.set(params.key, recentAttempts);

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

export function getRetryAfterHeaders(
  retryAfterSeconds: number
): Record<string, string> {
  return {
    'Retry-After': String(Math.max(1, retryAfterSeconds)),
  };
}
