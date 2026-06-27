import { NextRequest, NextResponse } from 'next/server';
import { getLeadById } from '@/lib/db/leads';
import { saveQualificationAnswer } from '@/lib/db/qualification';
import { logAuditEvent } from '@/lib/db/audit';
import { hasAuditEventForLead } from '@/lib/db/kyc';
import {
  isKycPaymentMethod,
  isKycYesNoValue,
  KYC_PAYMENT_ACCOUNT_FIELDS,
  type KycPaymentMethod,
  type KycYesNoValue,
} from '@/lib/kyc/requirements';
import { verifyInvestorSession } from '@/lib/investor-auth';

interface PaymentAccountPayload {
  expected_funding_method: KycPaymentMethod;
  expected_funding_bank_country: string;
  expected_funding_account_name: string;
  payment_from_own_account: KycYesNoValue;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validatePayload(
  body: Record<string, unknown>
): PaymentAccountPayload | null {
  const fundingMethod = body.expected_funding_method;
  const bankCountry = body.expected_funding_bank_country;
  const accountName = body.expected_funding_account_name;
  const ownAccount = body.payment_from_own_account;

  if (
    typeof fundingMethod !== 'string' ||
    !isKycPaymentMethod(fundingMethod) ||
    !isNonEmptyString(bankCountry) ||
    !isNonEmptyString(accountName) ||
    typeof ownAccount !== 'string' ||
    !isKycYesNoValue(ownAccount)
  ) {
    return null;
  }

  return {
    expected_funding_method: fundingMethod,
    expected_funding_bank_country: bankCountry.trim(),
    expected_funding_account_name: accountName.trim(),
    payment_from_own_account: ownAccount,
  };
}

export async function POST(
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

    if (lead.stage !== 'kyc_intake') {
      return NextResponse.json(
        { error: 'Lead is not in KYC intake stage' },
        { status: 400 }
      );
    }

    const hasConsent = await hasAuditEventForLead(leadId, 'kyc_consent_given');
    if (!hasConsent) {
      return NextResponse.json(
        { error: 'Consent must be recorded before payment account details are submitted' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const payload = validatePayload(body);

    if (!payload) {
      return NextResponse.json(
        {
          error:
            'Funding method, sending bank country, account name, and same-name account confirmation are required',
        },
        { status: 400 }
      );
    }

    await Promise.all(
      KYC_PAYMENT_ACCOUNT_FIELDS.map((field) =>
        saveQualificationAnswer({
          leadId,
          question: field,
          answer: payload[field],
          passed: true,
        })
      )
    );

    await logAuditEvent({
      leadId,
      eventType: 'kyc_payment_account_submitted',
      metadata: {
        expected_funding_method: payload.expected_funding_method,
        expected_funding_bank_country: payload.expected_funding_bank_country,
        payment_from_own_account: payload.payment_from_own_account,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving KYC payment account details:', error);
    return NextResponse.json(
      { error: 'Failed to save payment account details' },
      { status: 500 }
    );
  }
}
