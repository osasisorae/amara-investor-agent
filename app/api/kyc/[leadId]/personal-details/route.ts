import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, updateLead } from '@/lib/db/leads';
import { saveQualificationAnswer } from '@/lib/db/qualification';
import { logAuditEvent } from '@/lib/db/audit';
import { hasAuditEventForLead } from '@/lib/db/kyc';
import { KYC_PERSONAL_DETAIL_FIELDS } from '@/lib/kyc/config';

interface PersonalDetailsPayload {
  full_legal_name: string;
  date_of_birth: string;
  nationality: string;
  country_of_residence: string;
  phone_number: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validatePayload(body: Record<string, unknown>): PersonalDetailsPayload | null {
  const fullLegalName = body.full_legal_name;
  const dateOfBirth = body.date_of_birth;
  const nationality = body.nationality;
  const countryOfResidence = body.country_of_residence;
  const phoneNumber = body.phone_number;

  if (
    !isNonEmptyString(fullLegalName) ||
    !isNonEmptyString(dateOfBirth) ||
    !isNonEmptyString(nationality) ||
    !isNonEmptyString(countryOfResidence) ||
    !isNonEmptyString(phoneNumber)
  ) {
    return null;
  }

  return {
    full_legal_name: fullLegalName.trim(),
    date_of_birth: dateOfBirth.trim(),
    nationality: nationality.trim(),
    country_of_residence: countryOfResidence.trim(),
    phone_number: phoneNumber.trim(),
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;
    const body = (await request.json()) as Record<string, unknown>;

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
        { error: 'Consent must be recorded before personal details are submitted' },
        { status: 400 }
      );
    }

    const payload = validatePayload(body);
    if (!payload) {
      return NextResponse.json(
        { error: 'All personal detail fields are required' },
        { status: 400 }
      );
    }

    await Promise.all(
      KYC_PERSONAL_DETAIL_FIELDS.map((field) =>
        saveQualificationAnswer({
          leadId,
          question: field,
          answer: payload[field],
          passed: true,
        })
      )
    );

    await updateLead(leadId, {
      full_name: payload.full_legal_name,
      phone: payload.phone_number,
      country: payload.country_of_residence,
    });

    await logAuditEvent({
      leadId,
      eventType: 'kyc_personal_details_submitted',
      metadata: {
        fields: [...KYC_PERSONAL_DETAIL_FIELDS],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving KYC personal details:', error);
    return NextResponse.json(
      { error: 'Failed to save personal details' },
      { status: 500 }
    );
  }
}
