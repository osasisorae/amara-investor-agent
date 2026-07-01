import type { NextRequest } from 'next/server';
import {
  buildRateLimitKey,
  consumeSlidingWindowRateLimit,
  getRetryAfterHeaders,
} from './rate-limit';

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
  return buildRateLimitKey({
    scope: params.scope,
    keyParts: [params.ipAddress, params.identifier],
  });
}

export { consumeSlidingWindowRateLimit, getRetryAfterHeaders };
