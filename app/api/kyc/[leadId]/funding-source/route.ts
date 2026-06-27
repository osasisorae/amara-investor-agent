import { NextRequest, NextResponse } from 'next/server';
import { getLeadById } from '@/lib/db/leads';
import { saveQualificationAnswer } from '@/lib/db/qualification';
import { logAuditEvent } from '@/lib/db/audit';
import { hasAuditEventForLead } from '@/lib/db/kyc';
import {
  isKycSourceOfFundsType,
  KYC_FUNDING_SOURCE_FIELDS,
  type KycSourceOfFundsType,
} from '@/lib/kyc/requirements';
import { verifyInvestorSession } from '@/lib/investor-auth';

interface FundingSourcePayload {
  source_of_funds_type: KycSourceOfFundsType;
  source_of_funds_summary: string;
  source_of_wealth_summary: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validatePayload(
  body: Record<string, unknown>
): FundingSourcePayload | null {
  const sourceType = body.source_of_funds_type;
  const sourceSummary = body.source_of_funds_summary;
  const wealthSummary = body.source_of_wealth_summary;

  if (
    typeof sourceType !== 'string' ||
    !isKycSourceOfFundsType(sourceType) ||
    !isNonEmptyString(sourceSummary)
  ) {
    return null;
  }

  return {
    source_of_funds_type: sourceType,
    source_of_funds_summary: sourceSummary.trim(),
    source_of_wealth_summary:
      typeof wealthSummary === 'string' ? wealthSummary.trim() : '',
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
        { error: 'Consent must be recorded before funding details are submitted' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const payload = validatePayload(body);

    if (!payload) {
      return NextResponse.json(
        {
          error:
            'Funding source type and source of funds summary are required',
        },
        { status: 400 }
      );
    }

    await Promise.all(
      KYC_FUNDING_SOURCE_FIELDS.map((field) =>
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
      eventType: 'kyc_funding_source_submitted',
      metadata: {
        source_of_funds_type: payload.source_of_funds_type,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving KYC funding source:', error);
    return NextResponse.json(
      { error: 'Failed to save funding source details' },
      { status: 500 }
    );
  }
}
