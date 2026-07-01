import Image from 'next/image';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import AgreementClient from './agreement-client';
import {
  AGREEMENT_VERSION,
  buildAgreementInvestorParty,
  getAgreementMarkdown,
} from '@/lib/agreement/template';
import { buildInvestorAccessPath } from '@/lib/chat/access-link';
import { logAuditEvent } from '@/lib/db/audit';
import {
  getLeadById,
  markAgreementViewed,
} from '@/lib/db/leads';
import { getLatestQualificationAnswerMap } from '@/lib/db/qualification';
import { getInvestorSession } from '@/lib/investor-auth';
import { getLeadCommitmentSelection } from '@/lib/payment';
import { getClientIpAddress } from '@/lib/security/client-ip';

export default async function AgreementPage({
  params,
}: {
  params: { leadId: string };
}) {
  const lead = await getLeadById(params.leadId);

  if (!lead) {
    notFound();
  }

  const investorSession = await getInvestorSession();

  if (!investorSession || investorSession.leadId !== params.leadId) {
    redirect(
      buildInvestorAccessPath({
        reason: 'session_required',
        next: `/agreement/${params.leadId}`,
      })
    );
  }

  if (lead.kyc_approved !== 1 || !lead.approved_by) {
    redirect(`/chat/${params.leadId}`);
  }

  const headerStore = headers();
  const ipAddress = getClientIpAddress(headerStore);
  await markAgreementViewed(params.leadId);
  await logAuditEvent({
    leadId: params.leadId,
    eventType: 'agreement_viewed',
    metadata: {
      stage: lead.stage,
    },
    ipAddress,
    userAgent: headerStore.get('user-agent') || undefined,
  });

  const [commitment, latestAnswers] = await Promise.all([
    getLeadCommitmentSelection(params.leadId),
    getLatestQualificationAnswerMap(params.leadId),
  ]);
  const agreementLead = buildAgreementInvestorParty({
    lead,
    answers: latestAnswers,
  });
  const agreementMarkdown = getAgreementMarkdown({
    lead: agreementLead,
    commitmentLabel: commitment.commitmentLabel,
    slotCount: commitment.slotCount,
  });

  return (
    <div className="min-h-screen bg-futurex-bg">
      <header className="border-b border-futurex-line bg-futurex-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[#fffdf8] px-3 py-2 shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
              <Image
                src="/futurex-wordmark-email.png"
                alt="FutureX"
                width={132}
                height={74}
                className="h-7 w-auto"
              />
            </div>
            <div className="hidden text-[11px] uppercase tracking-[0.22em] text-futurex-muted sm:block">
              Master investment agreement
            </div>
          </div>
          <div className="rounded-full border border-futurex-gold-border bg-futurex-gold-soft px-3 py-1 text-xs font-semibold text-futurex-gold">
            Secure signing
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <AgreementClient
          lead={{
            id: lead.id,
            email: agreementLead.email,
            full_name: agreementLead.full_name,
            phone: agreementLead.phone,
            country: agreementLead.country,
            date_of_birth: agreementLead.date_of_birth,
            nationality: agreementLead.nationality,
            employer_or_business_address:
              agreementLead.employer_or_business_address,
            tax_identification_number: agreementLead.tax_identification_number,
            source_of_funds_type: agreementLead.source_of_funds_type,
            source_of_funds_summary: agreementLead.source_of_funds_summary,
            expected_funding_method: agreementLead.expected_funding_method,
            stage: lead.stage,
          }}
          agreementMarkdown={agreementMarkdown}
          initialCommitment={commitment}
          agreementVersion={AGREEMENT_VERSION}
        />
      </main>
    </div>
  );
}
