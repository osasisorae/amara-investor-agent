import { NextRequest, NextResponse } from 'next/server';
import { logAuditEvent } from '@/lib/db/audit';
import { queryOne } from '@/lib/db/client';
import { getLeadByEmail } from '@/lib/db/leads';
import { consumeOtpCode, createOtpCode } from '@/lib/db/otp';
import { sendEmail } from '@/lib/email/resend-client';
import { getInvestorAccessOtpEmailTemplate } from '@/lib/email/templates';
import {
  setInvestorSessionCookie,
  signInvestorSession,
} from '@/lib/investor-auth';

const CHAT_ACCESS_OTP_PURPOSE = 'chat_access';
const CHAT_ACCESS_OTP_EXPIRY_MINUTES = 10;
const GENERIC_ACCESS_MESSAGE =
  "If your email is in our system, you'll receive an access code shortly.";

interface OffereeRegisterRow {
  activated: number;
  full_name?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
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
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
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

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and access code are required.' },
        { status: 400 }
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

    const otp = await consumeOtpCode({
      leadId: lead.id,
      purpose: CHAT_ACCESS_OTP_PURPOSE,
      code,
    });

    if (!otp) {
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
