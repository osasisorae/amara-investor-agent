import { NextRequest, NextResponse } from 'next/server';
import { getLatestQualificationAnswerMap } from '@/lib/db/qualification';
import { logAuditEvent } from '@/lib/db/audit';
import { getLeadById } from '@/lib/db/leads';
import { saveMessage } from '@/lib/db/messages';
import { detectInvestorCurrencyFromLocation } from '@/lib/grey/currency';
import {
  getLeadCommitmentSelection,
  getPaymentConfirmationStatus,
  getPaymentReference,
} from '@/lib/payment';
import { PAYMENT_DETAILS } from '@/lib/payment-details';
import {
  getPaymentMethodLabel,
  isPaymentMethod,
} from '@/lib/payment-methods';
import { verifyInvestorSession } from '@/lib/investor-auth';
import { getClientIpAddress } from '@/lib/security/client-ip';

export async function GET(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;

    if (!(await verifyInvestorSession(request, leadId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lead = await getLeadById(leadId);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const confirmation = await getPaymentConfirmationStatus(leadId);
    const latestAnswers = await getLatestQualificationAnswerMap(leadId);
    const investorLocation =
      lead.country?.trim() ||
      latestAnswers.country_of_residence?.answer?.trim() ||
      latestAnswers.investor_profile?.answer?.trim() ||
      null;

    return NextResponse.json({
      leadStage: lead.stage,
      paymentDetails: PAYMENT_DETAILS,
      confirmation,
      investorLocation,
      investorCurrency: detectInvestorCurrencyFromLocation(investorLocation),
    });
  } catch (error) {
    console.error('Error loading payment confirmation state:', error);
    return NextResponse.json(
      { error: 'Failed to load payment confirmation state' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;
    const ipAddress = getClientIpAddress(request);

    if (!(await verifyInvestorSession(request, leadId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lead = await getLeadById(leadId);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.stage !== 'payment_pending') {
      return NextResponse.json(
        { error: 'Lead is not awaiting payment confirmation' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      method?: unknown;
      reference?: unknown;
    };
    const method = body.method;
    const reference =
      typeof body.reference === 'string' ? body.reference.trim() : '';

    if (!isPaymentMethod(method) || !reference) {
      return NextResponse.json(
        { error: 'Method and reference are required' },
        { status: 400 }
      );
    }

    const expectedReference = getPaymentReference(leadId);

    if (reference !== expectedReference) {
      return NextResponse.json(
        { error: 'Payment reference mismatch' },
        { status: 400 }
      );
    }

    const commitmentSelection = await getLeadCommitmentSelection(leadId);

    if (method === 'crypto' && commitmentSelection.slotCount < 2) {
      return NextResponse.json(
        { error: 'Crypto is only available for multi-slot commitments' },
        { status: 400 }
      );
    }

    const existingConfirmation = await getPaymentConfirmationStatus(leadId);

    if (existingConfirmation.confirmed) {
      return NextResponse.json({
        success: true,
        confirmation: existingConfirmation,
      });
    }

    await logAuditEvent({
      leadId,
      eventType: 'payment_confirmation_sent',
      metadata: {
        method,
        reference,
        commitment_amount_ngn: commitmentSelection.commitmentAmountNgn,
        slot_count: commitmentSelection.slotCount,
      },
      ipAddress,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    const createdAt = Math.floor(Date.now() / 1000);

    await saveMessage({
      leadId,
      role: 'agent',
      createdAt,
      content: `Thank you. We've noted that you've sent your payment via ${getPaymentMethodLabel(
        method
      )}. Our team will verify and confirm your allocation within 2 business days. You'll receive an email confirmation once verified.`,
    });

    return NextResponse.json({
      success: true,
      confirmation: {
        confirmed: true,
        method,
        reference,
        createdAt,
      },
    });
  } catch (error) {
    console.error('Error recording investor payment confirmation:', error);
    return NextResponse.json(
      { error: 'Failed to record payment confirmation' },
      { status: 500 }
    );
  }
}
