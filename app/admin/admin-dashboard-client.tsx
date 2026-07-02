'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AddInvestorButton } from '@/components/admin/AddInvestorButton';
import { AdminShell } from '@/components/admin/AdminShell';
import { ChatReviewPanel } from '@/components/admin/ChatReviewPanel';
import { KycReviewPanel } from '@/components/admin/KycReviewPanel';
import { SupportReviewPanel } from '@/components/admin/SupportReviewPanel';
import { useFeedback } from '@/components/feedback-provider';

interface Lead {
  id: string;
  email: string;
  stage: string;
  full_name?: string;
  country?: string;
  created_at: number;
  kyc_submitted_at?: number;
  qualificationSummary?: {
    investorProfile?: string | null;
    investmentHorizon?: string | null;
    ticketSize?: string | null;
    kycWillingness?: string | null;
    disqualificationReason?: string | null;
    futureInterestNote?: string | null;
  };
  opsSummary?: {
    humanReviewReason?: string | null;
    humanReviewOpen?: boolean;
    humanReviewRequestedAt?: number | null;
    humanReviewResolvedAt?: number | null;
    humanReviewResolvedBy?: string | null;
    paymentReference?: string | null;
    paymentConfirmedBy?: string | null;
  };
}

interface AdminPipelineClientProps {
  adminEmail: string;
}

export default function AdminPipelineClient({
  adminEmail,
}: AdminPipelineClientProps) {
  const router = useRouter();
  const { notify, confirm } = useFeedback();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKycLeadId, setExpandedKycLeadId] = useState<string | null>(
    null
  );
  const [expandedChatLeadId, setExpandedChatLeadId] = useState<string | null>(
    null
  );
  const [expandedSupportLeadId, setExpandedSupportLeadId] = useState<
    string | null
  >(null);

  useEffect(() => {
    fetchLeads();
  }, []);

  const redirectToLogin = () => {
    router.push('/admin/login');
    router.refresh();
  };

  const handleUnauthorized = (response: Response) => {
    if (response.status !== 401) {
      return false;
    }

    redirectToLogin();
    return true;
  };

  const fetchLeads = async () => {
    try {
      const response = await fetch('/api/admin/leads', {
        cache: 'no-store',
      });

      if (handleUnauthorized(response)) {
        return;
      }

      const data = await response.json();
      setLeads(data.leads || []);
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async (leadId: string) => {
    if (
      !(await confirm({
        title: 'Confirm payment',
        message: 'Mark this investor payment as received and close the record?',
        confirmLabel: 'Confirm payment',
      }))
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/payment/${leadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmedBy: adminEmail,
        }),
      });

      if (handleUnauthorized(response)) {
        return;
      }

      if (response.ok) {
        notify({
          title: 'Payment confirmed',
          message: 'The investor record has been moved to closed.',
          tone: 'success',
        });
        fetchLeads();
      } else {
        const error = await response.json();
        notify({
          title: 'Confirmation failed',
          message: error.error || 'Failed to confirm payment.',
          tone: 'error',
        });
      }
    } catch (error) {
      console.error('Failed to confirm payment:', error);
      notify({
        title: 'Confirmation failed',
        message: 'Failed to confirm payment.',
        tone: 'error',
      });
    }
  };

  const deleteLead = async (leadId: string, emailAddress: string) => {
    if (
      !(await confirm({
        title: 'Delete lead',
        message: `Delete lead ${emailAddress}? This will remove all associated data and allow re-adding this email.`,
        confirmLabel: 'Delete',
        tone: 'danger',
      }))
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/leads?leadId=${leadId}`, {
        method: 'DELETE',
      });

      if (handleUnauthorized(response)) {
        return;
      }

      if (response.ok) {
        notify({
          title: 'Lead deleted',
          message: 'Lead deleted successfully.',
          tone: 'success',
        });
        fetchLeads();
      } else {
        const error = await response.json();
        notify({
          title: 'Delete failed',
          message: error.error
            ? `Failed to delete lead: ${error.error}`
            : 'Failed to delete lead.',
          tone: 'error',
        });
      }
    } catch (error) {
      console.error('Failed to delete lead:', error);
      notify({
        title: 'Delete failed',
        message: 'Failed to delete lead.',
        tone: 'error',
      });
    }
  };

  const getStageColor = (lead: Lead) => {
    switch (lead.stage) {
      case 'outreach_sent':
        return 'bg-blue-100 text-blue-800';
      case 'qualifying':
        return 'bg-yellow-100 text-yellow-800';
      case 'deal_room':
        return 'bg-purple-100 text-purple-800';
      case 'kyc_intake':
        return 'bg-orange-100 text-orange-800';
      case 'pending_human_review':
        return 'bg-red-100 text-red-800';
      case 'agreement_pending':
        return 'bg-green-100 text-green-800';
      case 'agreement_signed':
        return 'bg-emerald-100 text-emerald-900';
      case 'payment_pending':
        return 'bg-indigo-100 text-indigo-900';
      case 'closed':
        return 'bg-slate-200 text-slate-900';
      case 'disqualified':
        return 'bg-rose-100 text-rose-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStageLabel = (lead: Lead) => {
    if (lead.stage === 'disqualified') {
      return 'not a fit';
    }

    return lead.stage.replace(/_/g, ' ');
  };

  const isAgreementStage = (stage: string) =>
    ['agreement_pending', 'agreement_signed', 'payment_pending', 'closed'].includes(
      stage
    );

  const canConfirmPayment = (lead: Lead) => lead.stage === 'payment_pending';
  const hasOpenSupportRequest = (lead: Lead) =>
    Boolean(lead.opsSummary?.humanReviewOpen);
  const openSupportCount = leads.filter(hasOpenSupportRequest).length;
  const paymentPendingCount = leads.filter(
    (lead) => lead.stage === 'payment_pending'
  ).length;
  const pendingKycCount = leads.filter(
    (lead) => lead.stage === 'pending_human_review'
  ).length;

  return (
    <AdminShell
      adminEmail={adminEmail}
      activePage="pipeline"
      title="Investor Pipeline"
      description="Review every investor record end to end, handle manual checkpoints, and prepare the surface for upcoming stage and operator filters."
      actions={
        <>
          <AddInvestorButton
            adminEmail={adminEmail}
            onUnauthorized={handleUnauthorized}
            onAdded={() => {
              void fetchLeads();
            }}
          />
          <div className="rounded-full border border-futurex-line px-4 py-2 text-sm text-futurex-muted">
            Filters landing here next
          </div>
        </>
      }
    >
        {openSupportCount > 0 ? (
          <div className="mb-8 rounded-lg border border-amber-500/30 bg-amber-500/10 p-6">
            <div className="text-sm font-semibold text-amber-100">
              Admin attention needed
            </div>
            <div className="mt-1 text-sm text-amber-200/85">
              {openSupportCount} investor
              {openSupportCount === 1 ? '' : 's'} currently need direct team
              follow-up from their chat.
            </div>
          </div>
        ) : null}

        <div className="mb-8 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-futurex-line bg-futurex-surface p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-futurex-muted">
              Total investors
            </div>
            <div className="mt-2 text-3xl font-semibold text-futurex-ink">
              {leads.length}
            </div>
            <div className="mt-1 text-sm text-futurex-muted">
              Every lead currently inside the admin pipeline.
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-amber-200/75">
              Team follow-up
            </div>
            <div className="mt-2 text-3xl font-semibold text-amber-100">
              {openSupportCount}
            </div>
            <div className="mt-1 text-sm text-amber-200/80">
              Investors currently waiting for direct human follow-up.
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-indigo-200/80">
              Manual checkpoints
            </div>
            <div className="mt-2 text-3xl font-semibold text-indigo-100">
              {pendingKycCount + paymentPendingCount}
            </div>
            <div className="mt-1 text-sm text-indigo-200/80">
              {pendingKycCount} KYC review
              {pendingKycCount === 1 ? '' : 's'} and {paymentPendingCount}{' '}
              payment confirmation
              {paymentPendingCount === 1 ? '' : 's'} are waiting.
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-futurex-line bg-futurex-surface p-6">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-serif text-futurex-ink">
                All Investors
              </h2>
              <p className="mt-2 text-sm text-futurex-muted">
                Filters are coming next. For now this page shows the full ordered
                pipeline with direct review controls for each investor.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin"
                className="rounded-full border border-futurex-line px-4 py-2 text-sm text-futurex-muted transition hover:border-futurex-gold hover:text-futurex-gold"
              >
                Back to Efficiency
              </Link>
              <AddInvestorButton
                adminEmail={adminEmail}
                onUnauthorized={handleUnauthorized}
                onAdded={() => {
                  void fetchLeads();
                }}
                buttonLabel="Add Investor"
                buttonClassName="rounded-full bg-futurex-gold px-4 py-2 text-sm font-semibold text-futurex-bg transition hover:opacity-90"
              />
            </div>
          </div>

          {loading ? (
            <p className="text-futurex-muted">Loading...</p>
          ) : leads.length === 0 ? (
            <p className="text-futurex-muted">
              No investors yet. Use “Add Investor” to create the first offeree
              record.
            </p>
          ) : (
            <div className="space-y-4">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded border border-futurex-line bg-futurex-surface2 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <h3 className="font-semibold text-futurex-ink">
                          {lead.full_name || lead.email}
                        </h3>
                        <span
                          className={`rounded-full px-3 py-1 text-xs ${getStageColor(
                            lead
                          )}`}
                        >
                          {formatStageLabel(lead)}
                        </span>
                      </div>
                      <p className="text-sm text-futurex-muted">{lead.email}</p>
                      <p className="mt-1 text-xs text-futurex-muted">
                        Added:{' '}
                        {new Date(lead.created_at * 1000).toLocaleDateString()}
                      </p>
                      {lead.country ? (
                        <p className="mt-1 text-xs text-futurex-muted">
                          Location: {lead.country}
                        </p>
                      ) : null}
                      {(lead.qualificationSummary?.investorProfile ||
                        lead.qualificationSummary?.investmentHorizon ||
                        lead.qualificationSummary?.ticketSize ||
                        lead.qualificationSummary?.kycWillingness ||
                        lead.qualificationSummary?.disqualificationReason ||
                        lead.qualificationSummary?.futureInterestNote ||
                        lead.opsSummary?.humanReviewReason ||
                        lead.opsSummary?.paymentReference ||
                        lead.opsSummary?.paymentConfirmedBy) && (
                        <div className="mt-3 space-y-2 text-sm">
                          {lead.qualificationSummary?.investorProfile ? (
                            <p className="text-futurex-muted">
                              <span className="font-medium text-futurex-ink">
                                Profile:
                              </span>{' '}
                              {lead.qualificationSummary.investorProfile}
                            </p>
                          ) : null}
                          {lead.qualificationSummary?.investmentHorizon ? (
                            <p className="text-futurex-muted">
                              <span className="font-medium text-futurex-ink">
                                Horizon:
                              </span>{' '}
                              {lead.qualificationSummary.investmentHorizon}
                            </p>
                          ) : null}
                          {lead.qualificationSummary?.ticketSize ? (
                            <p className="text-futurex-muted">
                              <span className="font-medium text-futurex-ink">
                                Ticket:
                              </span>{' '}
                              {lead.qualificationSummary.ticketSize}
                            </p>
                          ) : null}
                          {lead.qualificationSummary?.kycWillingness ? (
                            <p className="text-futurex-muted">
                              <span className="font-medium text-futurex-ink">
                                KYC:
                              </span>{' '}
                              {lead.qualificationSummary.kycWillingness}
                            </p>
                          ) : null}
                          {lead.qualificationSummary?.disqualificationReason ? (
                            <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-rose-200">
                              <span className="font-medium">Not a fit:</span>{' '}
                              {lead.qualificationSummary.disqualificationReason}
                            </div>
                          ) : null}
                          {lead.qualificationSummary?.futureInterestNote ? (
                            <div className="rounded-lg border border-futurex-gold-border bg-futurex-gold-soft px-3 py-2 text-futurex-gold">
                              <span className="font-medium">
                                Future interest:
                              </span>{' '}
                              {lead.qualificationSummary.futureInterestNote}
                            </div>
                          ) : null}
                          {lead.opsSummary?.humanReviewReason ? (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-100">
                              <span className="font-medium">
                                {lead.opsSummary?.humanReviewOpen
                                  ? 'Needs team follow-up:'
                                  : 'Last team follow-up:'}
                              </span>{' '}
                              {lead.opsSummary.humanReviewReason}
                            </div>
                          ) : null}
                          {lead.opsSummary?.paymentReference ? (
                            <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-indigo-100">
                              <span className="font-medium">
                                Payment reference:
                              </span>{' '}
                              {lead.opsSummary.paymentReference}
                            </div>
                          ) : null}
                          {lead.stage === 'payment_pending' &&
                          !lead.opsSummary?.paymentConfirmedBy ? (
                            <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sky-100">
                              <span className="font-medium">
                                Payment status:
                              </span>{' '}
                              Awaiting manual wire transfer from investor.
                            </div>
                          ) : null}
                          {lead.opsSummary?.paymentConfirmedBy ? (
                            <p className="text-futurex-muted">
                              <span className="font-medium text-futurex-ink">
                                Payment confirmed by:
                              </span>{' '}
                              {lead.opsSummary.paymentConfirmedBy}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {hasOpenSupportRequest(lead) ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSupportLeadId((current) =>
                              current === lead.id ? null : lead.id
                            )
                          }
                          className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 transition hover:border-amber-400 hover:bg-amber-500/15"
                        >
                          {expandedSupportLeadId === lead.id
                            ? 'Hide Follow-up'
                            : 'Review Follow-up'}
                        </button>
                      ) : null}
                      {lead.stage === 'pending_human_review' ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedKycLeadId((current) =>
                              current === lead.id ? null : lead.id
                            )
                          }
                          className="rounded border border-futurex-line px-4 py-2 text-sm text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold"
                        >
                          {expandedKycLeadId === lead.id
                            ? 'Hide Review'
                            : 'Review KYC'}
                        </button>
                      ) : null}
                      {lead.stage === 'payment_pending' ? (
                        <button
                          type="button"
                          onClick={() => confirmPayment(lead.id)}
                          disabled={!canConfirmPayment(lead)}
                          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-900/40 disabled:text-indigo-100/60"
                        >
                          Confirm Payment
                        </button>
                      ) : null}
                      {isAgreementStage(lead.stage) ? (
                        <Link
                          href={`/agreement/${lead.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-futurex-line px-4 py-2 text-sm text-futurex-ink hover:border-futurex-gold hover:text-futurex-gold"
                        >
                          View Agreement
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedChatLeadId((current) =>
                            current === lead.id ? null : lead.id
                          )
                        }
                        className="rounded bg-futurex-gold px-4 py-2 text-sm text-futurex-bg hover:opacity-90"
                      >
                        {expandedChatLeadId === lead.id
                          ? 'Hide Chat Review'
                          : 'Review Chat'}
                      </button>
                      <button
                        onClick={() => deleteLead(lead.id, lead.email)}
                        className="rounded bg-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-700"
                        title="Delete lead and all data"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {lead.stage === 'pending_human_review' ? (
                    <KycReviewPanel
                      leadId={lead.id}
                      isOpen={expandedKycLeadId === lead.id}
                      onUnauthorized={handleUnauthorized}
                      onComplete={() => {
                        setExpandedKycLeadId(null);
                        fetchLeads();
                      }}
                    />
                  ) : null}

                  <ChatReviewPanel
                    leadId={lead.id}
                    isOpen={expandedChatLeadId === lead.id}
                    onUnauthorized={handleUnauthorized}
                  />

                  {hasOpenSupportRequest(lead) ? (
                    <SupportReviewPanel
                      leadId={lead.id}
                      isOpen={expandedSupportLeadId === lead.id}
                      onUnauthorized={handleUnauthorized}
                      onComplete={() => {
                        setExpandedSupportLeadId(null);
                        fetchLeads();
                      }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
    </AdminShell>
  );
}
