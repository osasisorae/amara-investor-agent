import { NextRequest, NextResponse } from 'next/server';
import { getLeadById } from '@/lib/db/leads';
import { saveQualificationAnswer } from '@/lib/db/qualification';
import { logAuditEvent } from '@/lib/db/audit';
import { hasAuditEventForLead } from '@/lib/db/kyc';
import {
  KYC_INVESTOR_PROFILE_FIELDS,
  type KycInvestorProfileField,
} from '@/lib/kyc/requirements';
import { verifyInvestorSession } from '@/lib/investor-auth';

type InvestorProfilePayload = Record<KycInvestorProfileField, string>;

function validatePayload(
  body: Record<string, unknown>
): InvestorProfilePayload | null {
  const occupation =
    typeof body.occupation === 'string' ? body.occupation.trim() : '';
  const employerOrBusinessName =
    typeof body.employer_or_business_name === 'string'
      ? body.employer_or_business_name.trim()
      : '';
  const employerOrBusinessAddress =
    typeof body.employer_or_business_address === 'string'
      ? body.employer_or_business_address.trim()
      : '';
  const taxResidencyCountry =
    typeof body.tax_residency_country === 'string'
      ? body.tax_residency_country.trim()
      : '';
  const taxIdentificationNumber =
    typeof body.tax_identification_number === 'string'
      ? body.tax_identification_number.trim()
      : '';

  return {
    occupation,
    employer_or_business_name: employerOrBusinessName,
    employer_or_business_address: employerOrBusinessAddress,
    tax_residency_country: taxResidencyCountry,
    tax_identification_number: taxIdentificationNumber,
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
        { error: 'Consent must be recorded before investor profile is submitted' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const payload = validatePayload(body);

    if (!payload) {
      return NextResponse.json(
        { error: 'Failed to read investor profile details' },
        { status: 400 }
      );
    }

    await Promise.all(
      KYC_INVESTOR_PROFILE_FIELDS.map((field) =>
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
      eventType: 'kyc_investor_profile_submitted',
      metadata: {
        fields: [...KYC_INVESTOR_PROFILE_FIELDS],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving KYC investor profile:', error);
    return NextResponse.json(
      { error: 'Failed to save investor profile' },
      { status: 500 }
    );
  }
}
