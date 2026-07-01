import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  AGREEMENT_VERSION,
  buildAgreementInvestorParty,
  buildAgreementHashInput,
  getAgreementMarkdown,
} from '@/lib/agreement/template';
import { coerceCommitmentSlotCount } from '@/lib/agreement/commitment';
import { applyOrchestratorStageTransition } from '@/lib/agent/orchestrator';
import { countAuditEventsSince, logAuditEvent } from '@/lib/db/audit';
import {
  getLeadById,
  markAgreementSigned,
  updateLead,
} from '@/lib/db/leads';
import { saveMessage } from '@/lib/db/messages';
import { consumeOtpCode } from '@/lib/db/otp';
import { getLatestQualificationAnswerMap } from '@/lib/db/qualification';
import { verifyInvestorSession } from '@/lib/investor-auth';
import {
  getLeadCommitmentSelection,
  getPaymentReference,
  sendPaymentInstructions,
} from '@/lib/payment';
import {
  buildOtpRateLimitKey,
  consumeSlidingWindowRateLimit,
  getClientIpAddress,
  getRetryAfterHeaders,
} from '@/lib/security/otp-rate-limit';

const AGREEMENT_OTP_PURPOSE = 'agreement_sign';
const AGREEMENT_OTP_VERIFY_WINDOW_SECONDS = 15 * 60;
const AGREEMENT_OTP_MAX_VERIFY_ATTEMPTS = 5;
const AGREEMENT_OTP_FAILED_EVENT = 'agreement_otp_verification_failed';

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;
    const session = await verifyInvestorSession(request, leadId);
    const ipAddress = getClientIpAddress(request);
    const rateLimitIpAddress = ipAddress || 'unknown';

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verifyLimit = consumeSlidingWindowRateLimit({
      key: buildOtpRateLimitKey({
        scope: 'agreement-otp-verify',
        ipAddress: rateLimitIpAddress,
        identifier: leadId,
      }),
      maxAttempts: AGREEMENT_OTP_MAX_VERIFY_ATTEMPTS,
      windowSeconds: AGREEMENT_OTP_VERIFY_WINDOW_SECONDS,
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

    const body = await request.json();
    const fullName =
      typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const otpCode =
      typeof body.otpCode === 'string' ? body.otpCode.trim() : '';
    const requestedSlotCount = coerceCommitmentSlotCount(body.slotCount);

    if (!fullName || !otpCode || !requestedSlotCount) {
      return NextResponse.json(
        { error: 'Full name, slot count, and verification code are required' },
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

    const [commitmentSelection, latestAnswers] = await Promise.all([
      getLeadCommitmentSelection(leadId),
      getLatestQualificationAnswerMap(leadId),
    ]);

    if (requestedSlotCount !== commitmentSelection.slotCount) {
      return NextResponse.json(
        {
          error:
            'Your commitment changed after the verification code was issued. Please request a new code.',
        },
        { status: 409 }
      );
    }

    const failedAttempts = await countAuditEventsSince({
      leadId,
      eventType: AGREEMENT_OTP_FAILED_EVENT,
      since:
        Math.floor(Date.now() / 1000) - AGREEMENT_OTP_VERIFY_WINDOW_SECONDS,
    });

    if (failedAttempts >= AGREEMENT_OTP_MAX_VERIFY_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Try again later.' },
        {
          status: 429,
          headers: getRetryAfterHeaders(AGREEMENT_OTP_VERIFY_WINDOW_SECONDS),
        }
      );
    }

    const otpRecord = await consumeOtpCode({
      leadId,
      purpose: AGREEMENT_OTP_PURPOSE,
      code: otpCode,
    });

    if (!otpRecord) {
      await logAuditEvent({
        leadId,
        eventType: AGREEMENT_OTP_FAILED_EVENT,
        metadata: {
          purpose: AGREEMENT_OTP_PURPOSE,
        },
        ipAddress,
        userAgent: request.headers.get('user-agent') || undefined,
      });

      const nextFailedAttemptCount = failedAttempts + 1;

      if (nextFailedAttemptCount >= AGREEMENT_OTP_MAX_VERIFY_ATTEMPTS) {
        return NextResponse.json(
          { error: 'Too many verification attempts. Try again later.' },
          {
            status: 429,
            headers: getRetryAfterHeaders(AGREEMENT_OTP_VERIFY_WINDOW_SECONDS),
          }
        );
      }

      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    const signedAt = Math.floor(Date.now() / 1000);
    const agreementLead = buildAgreementInvestorParty({
      lead,
      answers: latestAnswers,
      fullNameOverride: fullName,
    });

    const agreementText = getAgreementMarkdown({
      lead: agreementLead,
      commitmentLabel: commitmentSelection.commitmentLabel,
      slotCount: commitmentSelection.slotCount,
      generatedAt: signedAt,
    });
    const documentHash = createHash('sha256')
      .update(
        buildAgreementHashInput({
          leadId,
          agreementText,
          signedAt,
        })
      )
      .digest('hex');

    await updateLead(leadId, {
      full_name: fullName,
    });
    await markAgreementSigned(leadId);
    await applyOrchestratorStageTransition(
      leadId,
      lead.stage,
      'agreement_signed'
    );
    await logAuditEvent({
      leadId,
      eventType: 'agreement_signed',
      metadata: {
        signed_at: signedAt,
        otp_issued_at: otpRecord.created_at,
        agreement_version: AGREEMENT_VERSION,
        document_hash: documentHash,
      },
      ipAddress,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    const paymentReference = getPaymentReference(leadId);
    let paymentWarning: string | undefined;

    try {
      const paymentResult = await sendPaymentInstructions({
        ...lead,
        full_name: fullName,
        stage: 'agreement_signed',
      });
      paymentWarning = paymentResult.warning;
    } catch (paymentError) {
      paymentWarning =
        paymentError instanceof Error
          ? paymentError.message
          : 'Payment instructions could not be sent automatically.';
    }

    await applyOrchestratorStageTransition(
      leadId,
      'agreement_signed',
      'payment_pending'
    );
    const paymentMessageCreatedAt = Math.floor(Date.now() / 1000);

    await saveMessage({
      leadId,
      role: 'agent',
      createdAt: paymentMessageCreatedAt,
      content: `Your agreement has been signed and verified. Your payment reference is ${paymentReference}. Choose how you'd like to send your funds below.`,
    });
    await saveMessage({
      leadId,
      role: 'agent',
      createdAt: paymentMessageCreatedAt + 1,
      content: '',
      metadata: {
        component: 'payment_method_selector',
        data: {
          paymentReference,
          commitmentAmountNgn: commitmentSelection.commitmentAmountNgn,
          slotCount: commitmentSelection.slotCount,
        },
      },
    });

    return NextResponse.json({
      success: true,
      stage: 'payment_pending',
      paymentReference,
      warning: paymentWarning,
    });
  } catch (error) {
    console.error('Error signing agreement:', error);
    return NextResponse.json(
      { error: 'Failed to sign agreement' },
      { status: 500 }
    );
  }
}
