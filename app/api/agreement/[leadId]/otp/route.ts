import { NextRequest, NextResponse } from 'next/server';
import { getLeadById } from '@/lib/db/leads';
import { logAuditEvent } from '@/lib/db/audit';
import { createOtpCode } from '@/lib/db/otp';
import { sendEmail } from '@/lib/email/resend-client';
import { getOtpEmailTemplate } from '@/lib/email/templates';

const AGREEMENT_OTP_PURPOSE = 'agreement_sign';
const OTP_EXPIRY_MINUTES = 10;

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;
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
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
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
