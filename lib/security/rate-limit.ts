import 'server-only';

import { createHash } from 'node:crypto';

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
  __futurexRateLimitStore?: RateLimitStore;
};

const rateLimitStore: RateLimitStore =
  globalRateLimitStore.__futurexRateLimitStore ??
  (globalRateLimitStore.__futurexRateLimitStore = new Map());

function hashKeyPart(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function getNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function getRecentAttempts(key: string, windowStart: number): number[] {
  const existing = rateLimitStore.get(key) || [];
  const recentAttempts = existing.filter((timestamp) => timestamp >= windowStart);
  rateLimitStore.set(key, recentAttempts);
  return recentAttempts;
}

export function buildRateLimitKey(params: {
  scope: string;
  keyParts: Array<string | null | undefined>;
}): string {
  const parts = [params.scope];

  for (const keyPart of params.keyParts) {
    if (keyPart) {
      parts.push(hashKeyPart(keyPart));
    }
  }

  return parts.join(':');
}

export function checkSlidingWindowRateLimit(
  params: SlidingWindowRateLimitParams
): SlidingWindowRateLimitResult {
  const now = getNowSeconds();
  const windowStart = now - params.windowSeconds;
  const recentAttempts = getRecentAttempts(params.key, windowStart);

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

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

export function recordSlidingWindowRateLimitAttempt(key: string): void {
  const now = getNowSeconds();
  const existing = rateLimitStore.get(key) || [];
  existing.push(now);
  rateLimitStore.set(key, existing);
}

export function resetSlidingWindowRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

export function consumeSlidingWindowRateLimit(
  params: SlidingWindowRateLimitParams
): SlidingWindowRateLimitResult {
  const limitStatus = checkSlidingWindowRateLimit(params);

  if (!limitStatus.allowed) {
    return limitStatus;
  }

  recordSlidingWindowRateLimitAttempt(params.key);

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
