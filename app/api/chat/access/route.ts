import { NextRequest, NextResponse } from 'next/server';
import { countAuditEventsSince, logAuditEvent } from '@/lib/db/audit';
import { queryOne } from '@/lib/db/client';
import { getLeadByEmail } from '@/lib/db/leads';
import { consumeOtpCode, createOtpCode, getOtpSendLimitStatus } from '@/lib/db/otp';
import { sendEmail } from '@/lib/email/resend-client';
import { getInvestorAccessOtpEmailTemplate } from '@/lib/email/templates';
import {
  setInvestorSessionCookie,
  signInvestorSession,
} from '@/lib/investor-auth';
import {
  buildOtpRateLimitKey,
  consumeSlidingWindowRateLimit,
  getClientIpAddress,
  getRetryAfterHeaders,
} from '@/lib/security/otp-rate-limit';

const CHAT_ACCESS_OTP_PURPOSE = 'chat_access';
const CHAT_ACCESS_OTP_EXPIRY_MINUTES = 5;
const CHAT_ACCESS_SEND_COOLDOWN_SECONDS = 60;
const CHAT_ACCESS_SEND_WINDOW_SECONDS = 60 * 60;
const CHAT_ACCESS_MAX_SENDS_PER_WINDOW = 5;
const CHAT_ACCESS_REQUEST_WINDOW_SECONDS = 10 * 60;
const CHAT_ACCESS_MAX_REQUESTS_PER_WINDOW = 5;
const CHAT_ACCESS_VERIFY_WINDOW_SECONDS = 15 * 60;
const CHAT_ACCESS_MAX_VERIFY_ATTEMPTS = 5;
const GENERIC_ACCESS_MESSAGE =
  "If your email is in our system, you'll receive an access code shortly.";
const CHAT_ACCESS_FAILED_OTP_EVENT = 'chat_access_otp_verification_failed';

interface OffereeRegisterRow {
  activated: number;
  full_name?: string | null;
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    {
      status: 405,
      headers: {
        Allow: 'POST, PATCH',
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const ipAddress = getClientIpAddress(request);
    const rateLimitIpAddress = ipAddress || 'unknown';

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const requestLimit = consumeSlidingWindowRateLimit({
      key: buildOtpRateLimitKey({
        scope: 'chat-access-send',
        ipAddress: rateLimitIpAddress,
        identifier: ipAddress ? undefined : email || 'anonymous',
      }),
      maxAttempts: CHAT_ACCESS_MAX_REQUESTS_PER_WINDOW,
      windowSeconds: CHAT_ACCESS_REQUEST_WINDOW_SECONDS,
    });

    if (!requestLimit.allowed) {
      return NextResponse.json(
        { error: 'Please wait before requesting another access code.' },
        {
          status: 429,
          headers: getRetryAfterHeaders(requestLimit.retryAfterSeconds),
        }
      );
    }

    const lead = await getLeadByEmail(email);
    const offeree = await queryOne<OffereeRegisterRow>(
      `SELECT activated, full_name
       FROM offeree_register
       WHERE email = ?`,
      [email]
    );

    if (!lead || !offeree || offeree.activated !== 1) {
      return NextResponse.json({
        success: true,
        message: GENERIC_ACCESS_MESSAGE,
      });
    }

    const otpSendLimit = await getOtpSendLimitStatus({
      leadId: lead.id,
      purpose: CHAT_ACCESS_OTP_PURPOSE,
      cooldownSeconds: CHAT_ACCESS_SEND_COOLDOWN_SECONDS,
      windowSeconds: CHAT_ACCESS_SEND_WINDOW_SECONDS,
      maxCodesPerWindow: CHAT_ACCESS_MAX_SENDS_PER_WINDOW,
    });

    if (!otpSendLimit.allowed) {
      return NextResponse.json({
        success: true,
        message: GENERIC_ACCESS_MESSAGE,
      });
    }

    const otp = await createOtpCode({
      leadId: lead.id,
      purpose: CHAT_ACCESS_OTP_PURPOSE,
      ttlMinutes: CHAT_ACCESS_OTP_EXPIRY_MINUTES,
    });
    const emailTemplate = getInvestorAccessOtpEmailTemplate({
      investorName: lead.full_name || offeree.full_name || 'Investor',
      otpCode: otp.code,
      expiryMinutes: CHAT_ACCESS_OTP_EXPIRY_MINUTES,
    });

    await sendEmail({
      to: lead.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });
    await logAuditEvent({
      leadId: lead.id,
      eventType: 'otp_sent',
      metadata: {
        purpose: CHAT_ACCESS_OTP_PURPOSE,
        expires_at: otp.expires_at,
      },
      ipAddress,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: GENERIC_ACCESS_MESSAGE,
    });
  } catch (error) {
    console.error('Error creating investor chat access OTP:', error);
    return NextResponse.json(
      { error: 'Failed to send access code' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const ipAddress = getClientIpAddress(request);
    const rateLimitIpAddress = ipAddress || 'unknown';

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and access code are required.' },
        { status: 400 }
      );
    }

    const verifyLimit = consumeSlidingWindowRateLimit({
      key: buildOtpRateLimitKey({
        scope: 'chat-access-verify',
        ipAddress: rateLimitIpAddress,
        identifier: ipAddress ? undefined : email || 'anonymous',
      }),
      maxAttempts: CHAT_ACCESS_MAX_VERIFY_ATTEMPTS,
      windowSeconds: CHAT_ACCESS_VERIFY_WINDOW_SECONDS,
    });

    if (!verifyLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Try again later.' },
        {
          status: 429,
          headers: getRetryAfterHeaders(verifyLimit.retryAfterSeconds),
        }
      );
    }

    const lead = await getLeadByEmail(email);
    const offeree = await queryOne<OffereeRegisterRow>(
      `SELECT activated
       FROM offeree_register
       WHERE email = ?`,
      [email]
    );

    if (!lead || !offeree || offeree.activated !== 1) {
      return NextResponse.json(
        { error: 'Invalid or expired access code.' },
        { status: 400 }
      );
    }

    const failedAttempts = await countAuditEventsSince({
      leadId: lead.id,
      eventType: CHAT_ACCESS_FAILED_OTP_EVENT,
      since:
        Math.floor(Date.now() / 1000) - CHAT_ACCESS_VERIFY_WINDOW_SECONDS,
    });

    if (failedAttempts >= CHAT_ACCESS_MAX_VERIFY_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Try again later.' },
        {
          status: 429,
          headers: getRetryAfterHeaders(CHAT_ACCESS_VERIFY_WINDOW_SECONDS),
        }
      );
    }

    const otp = await consumeOtpCode({
      leadId: lead.id,
      purpose: CHAT_ACCESS_OTP_PURPOSE,
      code,
    });

    if (!otp) {
      await logAuditEvent({
        leadId: lead.id,
        eventType: CHAT_ACCESS_FAILED_OTP_EVENT,
        metadata: {
          purpose: CHAT_ACCESS_OTP_PURPOSE,
        },
        ipAddress,
        userAgent: request.headers.get('user-agent') || undefined,
      });

      const nextFailedAttemptCount = failedAttempts + 1;

      if (nextFailedAttemptCount >= CHAT_ACCESS_MAX_VERIFY_ATTEMPTS) {
        return NextResponse.json(
          { error: 'Too many verification attempts. Try again later.' },
          {
            status: 429,
            headers: getRetryAfterHeaders(CHAT_ACCESS_VERIFY_WINDOW_SECONDS),
          }
        );
      }

      return NextResponse.json(
        { error: 'Invalid or expired access code.' },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      success: true,
      leadId: lead.id,
    });

    const token = await signInvestorSession({
      leadId: lead.id,
      email: lead.email,
      role: 'investor',
    });
    setInvestorSessionCookie(response, token);

    return response;
  } catch (error) {
    console.error('Error verifying investor chat access OTP:', error);
    return NextResponse.json(
      { error: 'Failed to verify access code' },
      { status: 500 }
    );
  }
}
