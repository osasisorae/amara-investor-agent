import type { Lead } from '@/lib/db/leads';
import {
  MINIMUM_HOLD_YEARS,
  MINIMUM_TICKET_NGN,
} from '@/lib/agent/qualification';

export const SPV_NAME = 'Akwa Ibom Hospitality SPV';
export const SPV_CODE = 'AIHV';
export const TARGET_RETURN = '18% annual appreciation target';
export const EXIT_STRATEGY = 'Sale or refinance at the end of the hold period';
export const AGREEMENT_VERSION = 'FutureX-AIHV-Subscription-v1.0';

export const DEAL_ROOM_FACTS = [
  { label: 'SPV name', value: SPV_NAME },
  { label: 'Target return', value: TARGET_RETURN },
  { label: 'Hold period', value: `${MINIMUM_HOLD_YEARS} years` },
  {
    label: 'Minimum ticket',
    value: `₦${MINIMUM_TICKET_NGN.toLocaleString('en-NG')}`,
  },
  { label: 'Exit', value: EXIT_STRATEGY },
];

export function getAgreementMarkdown(params: {
  lead: Lead;
  commitmentLabel: string;
  generatedAt?: number;
}): string {
  const generatedAt =
    params.generatedAt ?? Math.floor(Date.now() / 1000);
  const generatedDate = new Date(generatedAt * 1000).toLocaleDateString(
    'en-NG',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  );
  const investorName = params.lead.full_name || 'Investor';

  return `# FutureX Subscription Agreement

**Version:** ${AGREEMENT_VERSION}  
**Vehicle:** ${SPV_NAME}  
**Generated:** ${generatedDate}

## Parties

This agreement is between **FutureX** (as arranger and operator) and **${investorName}** (${params.lead.email}) in relation to a subscription into the **${SPV_NAME}**.

## Investor Commitment

- Investor email: ${params.lead.email}
- Recorded commitment: ${params.commitmentLabel}
- Minimum hold period: ${MINIMUM_HOLD_YEARS} years
- Expected exit path: ${EXIT_STRATEGY}

## Structure

The investor is subscribing for a fractional economic interest in the SPV that holds the Akwa Ibom hospitality project. The SPV owns the project assets, collects revenues, and distributes investor proceeds according to the governing documents and operating model supplied in the deal room.

## Key Terms

1. Capital is expected to remain committed for the full ${MINIMUM_HOLD_YEARS}-year hold period unless otherwise stated in a formal FutureX amendment.
2. FutureX manages project execution, reporting, and operations in line with the deal documentation already provided.
3. Investor onboarding remains subject to completed KYC, sanctions screening, and internal compliance approval.
4. This subscription does not become effective until the investor signs this agreement and FutureX issues payment instructions tied to a unique reference.

## Disclosures

- This is a private investment opportunity for qualified investors only.
- Projected returns are targets, not guarantees.
- Real estate development, occupancy, regulatory, and FX risks can affect returns and timing.
- The investor confirms they have reviewed the deal materials and had the opportunity to ask questions before signing.

## Signature

By signing, the investor confirms:

- they are acting for their own account or a disclosed investment vehicle;
- the information supplied during qualification and KYC is accurate;
- they understand the illiquid nature of the investment;
- they authorize FutureX to issue payment instructions for the committed amount once signing is complete.

**Investor legal name:** ______________________  
**Date signed:** ______________________
`;
}

export function buildAgreementHashInput(params: {
  leadId: string;
  agreementText: string;
  signedAt: number;
}): string {
  return `${params.leadId}\n${params.signedAt}\n${params.agreementText}`;
}
