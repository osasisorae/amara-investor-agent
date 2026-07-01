import {
  buildRateLimitKey,
  consumeSlidingWindowRateLimit,
  getRetryAfterHeaders,
} from './rate-limit';
export { getClientIpAddress } from './client-ip';

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
