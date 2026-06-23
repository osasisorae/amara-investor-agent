import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  AGREEMENT_VERSION,
  buildAgreementHashInput,
  getAgreementMarkdown,
} from '@/lib/agreement/template';
import { applyOrchestratorStageTransition } from '@/lib/agent/orchestrator';
import { logAuditEvent } from '@/lib/db/audit';
import {
  getLeadById,
  markAgreementSigned,
  updateLead,
} from '@/lib/db/leads';
import { consumeOtpCode } from '@/lib/db/otp';
import {
  resolveCommitmentLabel,
  triggerPaymentInstructions,
} from '@/lib/payment';

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

    if (!fullName || !otpCode) {
      return NextResponse.json(
        { error: 'Full name and verification code are required' },
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
    const commitmentLabel = await resolveCommitmentLabel(leadId);
    const agreementText = getAgreementMarkdown({
      lead: {
        ...lead,
        full_name: fullName,
      },
      commitmentLabel,
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
        otp_verified_at: signedAt,
        otp_issued_at: otpRecord.created_at,
        agreement_version: AGREEMENT_VERSION,
        document_hash: documentHash,
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    let paymentReference: string | undefined;
    let paymentWarning: string | undefined;
    let nextStage: 'agreement_signed' | 'payment_pending' = 'agreement_signed';

    try {
      const paymentResult = await triggerPaymentInstructions({
        ...lead,
        full_name: fullName,
        stage: 'agreement_signed',
      });
      await applyOrchestratorStageTransition(leadId, 'payment_pending');
      paymentReference = paymentResult.paymentReference;
      nextStage = 'payment_pending';
    } catch (paymentError) {
      paymentWarning =
        paymentError instanceof Error
          ? paymentError.message
          : 'Payment instructions could not be sent automatically.';
    }

    return NextResponse.json({
      success: true,
      stage: nextStage,
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
