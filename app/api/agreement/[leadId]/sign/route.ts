import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  AGREEMENT_VERSION,
  buildAgreementHashInput,
  getAgreementMarkdown,
} from '@/lib/agreement/template';
import { coerceCommitmentSlotCount } from '@/lib/agreement/commitment';
import { applyOrchestratorStageTransition } from '@/lib/agent/orchestrator';
import { logAuditEvent } from '@/lib/db/audit';
import {
  getLeadById,
  markAgreementSigned,
  updateLead,
} from '@/lib/db/leads';
import { saveMessage } from '@/lib/db/messages';
import { consumeOtpCode } from '@/lib/db/otp';
import {
  getLeadCommitmentSelection,
  getPaymentReference,
  sendPaymentInstructions,
} from '@/lib/payment';
import { PAYMENT_DETAILS } from '@/lib/payment-details';

const AGREEMENT_OTP_PURPOSE = 'agreement_sign';

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;
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

    const commitmentSelection = await getLeadCommitmentSelection(leadId);

    if (requestedSlotCount !== commitmentSelection.slotCount) {
      return NextResponse.json(
        {
          error:
            'Your commitment changed after the verification code was issued. Please request a new code.',
        },
        { status: 409 }
      );
    }

    const otpRecord = await consumeOtpCode({
      leadId,
      purpose: AGREEMENT_OTP_PURPOSE,
      code: otpCode,
    });

    if (!otpRecord) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    const signedAt = Math.floor(Date.now() / 1000);

    const agreementText = getAgreementMarkdown({
      lead: {
        email: lead.email,
        full_name: fullName,
      },
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
    await applyOrchestratorStageTransition(leadId, 'agreement_signed');
    await logAuditEvent({
      leadId,
      eventType: 'agreement_signed',
      metadata: {
        typed_name: fullName,
        signed_at: signedAt,
        otp_verified_at: signedAt,
        otp_issued_at: otpRecord.created_at,
        slot_count: commitmentSelection.slotCount,
        commitment_amount_ngn: commitmentSelection.commitmentAmountNgn,
        agreement_version: AGREEMENT_VERSION,
        document_hash: documentHash,
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
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

    await applyOrchestratorStageTransition(leadId, 'payment_pending');
    const paymentMessageCreatedAt = Math.floor(Date.now() / 1000);

    await saveMessage({
      leadId,
      role: 'agent',
      createdAt: paymentMessageCreatedAt,
      content: `Your agreement has been signed and verified. Your payment reference is ${paymentReference}. Payment instructions have been sent to your email — please review them to complete your investment.`,
    });
    await saveMessage({
      leadId,
      role: 'agent',
      createdAt: paymentMessageCreatedAt + 1,
      content: '',
      metadata: {
        component: 'payment_instructions',
        data: {
          paymentReference,
          commitmentAmountNgn: commitmentSelection.commitmentAmountNgn,
          slotCount: commitmentSelection.slotCount,
          paymentDetails: PAYMENT_DETAILS,
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
