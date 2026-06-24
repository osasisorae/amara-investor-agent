import Image from 'next/image';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import AgreementClient from './agreement-client';
import { getAgreementMarkdown } from '@/lib/agreement/template';
import { logAuditEvent } from '@/lib/db/audit';
import {
  getLeadById,
  markAgreementViewed,
} from '@/lib/db/leads';
import {
  getLeadCommitmentSelection,
  getPaymentReference,
} from '@/lib/payment';

export default async function AgreementPage({
  params,
}: {
  params: { leadId: string };
}) {
  const lead = await getLeadById(params.leadId);

  if (!lead) {
    notFound();
  }

  if (lead.kyc_approved !== 1 || !lead.approved_by) {
    redirect(`/chat/${params.leadId}`);
  }

  const headerStore = headers();
  await markAgreementViewed(params.leadId);
  await logAuditEvent({
    leadId: params.leadId,
    eventType: 'agreement_viewed',
    metadata: {
      stage: lead.stage,
    },
    ipAddress: headerStore.get('x-forwarded-for') || undefined,
    userAgent: headerStore.get('user-agent') || undefined,
  });

  const commitment = await getLeadCommitmentSelection(params.leadId);
  const initialPaymentReference =
    lead.stage === 'agreement_pending'
      ? null
      : getPaymentReference(params.leadId);
  const agreementMarkdown = getAgreementMarkdown({
    lead,
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
              Investor agreement
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
            email: lead.email,
            full_name: lead.full_name,
            stage: lead.stage,
          }}
          agreementMarkdown={agreementMarkdown}
          initialCommitment={commitment}
          initialPaymentReference={initialPaymentReference}
        />
      </main>
    </div>
  );
}
