import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  clearAdminSessionCookie,
  setAdminSessionCookie,
  signAdminSession,
} from '@/lib/admin-auth';
import {
  getRequiredEmailEnv,
  getRequiredEnvValue,
} from '@/lib/security/env';
import {
  buildRateLimitKey,
  checkSlidingWindowRateLimit,
  getRetryAfterHeaders,
  recordSlidingWindowRateLimitAttempt,
  resetSlidingWindowRateLimit,
} from '@/lib/security/rate-limit';
import { getClientIpAddress } from '@/lib/security/otp-rate-limit';

const CONFIGURED_ADMIN_EMAIL = getRequiredEmailEnv('ADMIN_EMAIL');
const CONFIGURED_ADMIN_PASSWORD = getRequiredEnvValue('ADMIN_PASSWORD', {
  trim: false,
});
const ADMIN_AUTH_WINDOW_SECONDS = 15 * 60;
const ADMIN_AUTH_MAX_FAILED_ATTEMPTS_PER_IP = 10;
const ADMIN_AUTH_MAX_FAILED_ATTEMPTS_PER_IP_AND_EMAIL = 5;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function timingSafeEqualText(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();

  return timingSafeEqual(leftHash, rightHash);
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    {
      status: 405,
      headers: {
        Allow: 'POST, DELETE',
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    const email =
      typeof body?.email === 'string' ? normalizeEmail(body.email) : '';
    const password =
      typeof body?.password === 'string' ? body.password : '';
    const ipAddress = getClientIpAddress(request);
    const rateLimitIpAddress = ipAddress || 'unknown';
    const ipRateLimitKey = buildRateLimitKey({
      scope: 'admin-auth-ip',
      keyParts: [rateLimitIpAddress],
    });
    const emailRateLimitKey = buildRateLimitKey({
      scope: 'admin-auth-email',
      keyParts: [rateLimitIpAddress, email || 'anonymous'],
    });
    const ipRateLimit = checkSlidingWindowRateLimit({
      key: ipRateLimitKey,
      maxAttempts: ADMIN_AUTH_MAX_FAILED_ATTEMPTS_PER_IP,
      windowSeconds: ADMIN_AUTH_WINDOW_SECONDS,
    });
    const emailRateLimit = checkSlidingWindowRateLimit({
      key: emailRateLimitKey,
      maxAttempts: ADMIN_AUTH_MAX_FAILED_ATTEMPTS_PER_IP_AND_EMAIL,
      windowSeconds: ADMIN_AUTH_WINDOW_SECONDS,
    });

    if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
      const retryAfterSeconds = Math.max(
        ipRateLimit.retryAfterSeconds,
        emailRateLimit.retryAfterSeconds
      );

      return NextResponse.json(
        { error: 'Too many login attempts. Try again later.' },
        {
          status: 429,
          headers: getRetryAfterHeaders(retryAfterSeconds),
        }
      );
    }

    if (
      !timingSafeEqualText(email, CONFIGURED_ADMIN_EMAIL) ||
      !timingSafeEqualText(password, CONFIGURED_ADMIN_PASSWORD)
    ) {
      recordSlidingWindowRateLimitAttempt(ipRateLimitKey);
      recordSlidingWindowRateLimitAttempt(emailRateLimitKey);

      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    resetSlidingWindowRateLimit(ipRateLimitKey);
    resetSlidingWindowRateLimit(emailRateLimitKey);

    const session = {
      email: CONFIGURED_ADMIN_EMAIL,
      role: 'admin' as const,
    };
    const token = await signAdminSession(session);
    const response = NextResponse.json({
      success: true,
      session,
    });

    setAdminSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error('Admin login failed:', error);
    return NextResponse.json(
      { error: 'Failed to sign in.' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  clearAdminSessionCookie(response);
  return response;
}
