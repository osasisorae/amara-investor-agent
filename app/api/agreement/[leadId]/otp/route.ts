import { NextRequest, NextResponse } from 'next/server';
import { coerceCommitmentSlotCount } from '@/lib/agreement/commitment';
import { logAuditEvent } from '@/lib/db/audit';
import { getLeadById } from '@/lib/db/leads';
import { createOtpCode, getOtpSendLimitStatus } from '@/lib/db/otp';
import { sendEmail } from '@/lib/email/resend-client';
import { getOtpEmailTemplate } from '@/lib/email/templates';
import { verifyInvestorSession } from '@/lib/investor-auth';
import { saveLeadCommitmentSelection } from '@/lib/payment';
import {
  buildOtpRateLimitKey,
  consumeSlidingWindowRateLimit,
  getClientIpAddress,
  getRetryAfterHeaders,
} from '@/lib/security/otp-rate-limit';

const AGREEMENT_OTP_PURPOSE = 'agreement_sign';
const OTP_EXPIRY_MINUTES = 10;
const AGREEMENT_OTP_SEND_COOLDOWN_SECONDS = 60;
const AGREEMENT_OTP_SEND_WINDOW_SECONDS = 60 * 60;
const AGREEMENT_OTP_MAX_SENDS_PER_WINDOW = 5;
const AGREEMENT_OTP_REQUEST_WINDOW_SECONDS = 10 * 60;
const AGREEMENT_OTP_MAX_REQUESTS_PER_WINDOW = 5;

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;
    const session = await verifyInvestorSession(request, leadId);
    const ipAddress = getClientIpAddress(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestLimit = consumeSlidingWindowRateLimit({
      key: buildOtpRateLimitKey({
        scope: 'agreement-otp-send',
        ipAddress,
        identifier: leadId,
      }),
      maxAttempts: AGREEMENT_OTP_MAX_REQUESTS_PER_WINDOW,
      windowSeconds: AGREEMENT_OTP_REQUEST_WINDOW_SECONDS,
    });

    if (!requestLimit.allowed) {
      return NextResponse.json(
        { error: 'Please wait before requesting another verification code.' },
        {
          status: 429,
          headers: getRetryAfterHeaders(requestLimit.retryAfterSeconds),
        }
      );
    }

    const body = await request.json().catch(() => ({}));
    const slotCount = coerceCommitmentSlotCount(body.slotCount);

    if (!slotCount) {
      return NextResponse.json(
        { error: 'A valid slot count is required before signing.' },
        { status: 400 }
      );
    }

    const lead = await getLeadById(leadId);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.kyc_approved !== 1 || !lead.approved_by) {
      return NextResponse.json(
        { error: 'Agreement access is locked until KYC is approved' },
        { status: 403 }
      );
    }

    if (lead.agreement_signed_at) {
      return NextResponse.json(
        { error: 'Agreement has already been signed' },
        { status: 400 }
      );
    }

    const otpSendLimit = await getOtpSendLimitStatus({
      leadId,
      purpose: AGREEMENT_OTP_PURPOSE,
      cooldownSeconds: AGREEMENT_OTP_SEND_COOLDOWN_SECONDS,
      windowSeconds: AGREEMENT_OTP_SEND_WINDOW_SECONDS,
      maxCodesPerWindow: AGREEMENT_OTP_MAX_SENDS_PER_WINDOW,
    });

    if (!otpSendLimit.allowed) {
      return NextResponse.json(
        { error: 'Please wait before requesting another verification code.' },
        {
          status: 429,
          headers: getRetryAfterHeaders(otpSendLimit.retryAfterSeconds),
        }
      );
    }

    const commitmentSelection = await saveLeadCommitmentSelection({
      leadId,
      slotCount,
    });

    const otp = await createOtpCode({
      leadId,
      purpose: AGREEMENT_OTP_PURPOSE,
      ttlMinutes: OTP_EXPIRY_MINUTES,
    });

    const emailTemplate = getOtpEmailTemplate({
      investorName: lead.full_name || 'Investor',
      otpCode: otp.code,
      expiryMinutes: OTP_EXPIRY_MINUTES,
    });

    await sendEmail({
      to: lead.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    await logAuditEvent({
      leadId,
      eventType: 'otp_sent',
      metadata: {
        purpose: AGREEMENT_OTP_PURPOSE,
        expires_at: otp.expires_at,
        slot_count: commitmentSelection.slotCount,
        commitment_amount_ngn: commitmentSelection.commitmentAmountNgn,
      },
      ipAddress,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      expiresAt: otp.expires_at,
    });
  } catch (error) {
    console.error('Error sending agreement OTP:', error);
    return NextResponse.json(
      { error: 'Failed to send verification code' },
      { status: 500 }
    );
  }
}
