import { NextRequest, NextResponse } from 'next/server';
import { getLeadById } from '@/lib/db/leads';
import { saveQualificationAnswer } from '@/lib/db/qualification';
import { logAuditEvent } from '@/lib/db/audit';
import { hasAuditEventForLead } from '@/lib/db/kyc';
import {
  isKycYesNoValue,
  KYC_RISK_DECLARATION_FIELDS,
  type KycRiskDeclarationField,
  type KycYesNoValue,
} from '@/lib/kyc/requirements';
import { verifyInvestorSession } from '@/lib/investor-auth';

type RiskDeclarationsPayload = Record<KycRiskDeclarationField, KycYesNoValue>;

function validatePayload(
  body: Record<string, unknown>
): RiskDeclarationsPayload | null {
  const payload: Partial<RiskDeclarationsPayload> = {};

  for (const field of KYC_RISK_DECLARATION_FIELDS) {
    const value = body[field];

    if (typeof value !== 'string' || !isKycYesNoValue(value)) {
      return null;
    }

    payload[field] = value;
  }

  return payload as RiskDeclarationsPayload;
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
        { error: 'Consent must be recorded before risk declarations are submitted' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const payload = validatePayload(body);

    if (!payload) {
      return NextResponse.json(
        { error: 'Every risk declaration must be answered yes or no' },
        { status: 400 }
      );
    }

    await Promise.all(
      KYC_RISK_DECLARATION_FIELDS.map((field) =>
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
      eventType: 'kyc_risk_declarations_submitted',
      metadata: {
        field_count: KYC_RISK_DECLARATION_FIELDS.length,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving KYC risk declarations:', error);
    return NextResponse.json(
      { error: 'Failed to save risk declarations' },
      { status: 500 }
    );
  }
}
