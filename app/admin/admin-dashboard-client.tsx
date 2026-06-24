'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KycReviewPanel } from '@/components/admin/KycReviewPanel';
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
    paymentReference?: string | null;
    paymentConfirmedBy?: string | null;
  };
}

interface AdminDashboardClientProps {
  adminEmail: string;
}

export default function AdminDashboardClient({
  adminEmail,
}: AdminDashboardClientProps) {
  const router = useRouter();
  const { notify, confirm } = useFeedback();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [notes, setNotes] = useState('');
  const [adding, setAdding] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [expandedKycLeadId, setExpandedKycLeadId] = useState<string | null>(
    null
  );

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

  const logout = async () => {
    setLoggingOut(true);

    try {
      await fetch('/api/admin/auth', {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to log out cleanly:', error);
    } finally {
      redirectToLogin();
      setLoggingOut(false);
    }
  };

  const addOfferee = async (event: React.FormEvent) => {
    event.preventDefault();
    setAdding(true);

    try {
      const response = await fetch('/api/admin/offeree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          fullName,
          notes,
          addedBy: adminEmail,
        }),
      });

      if (handleUnauthorized(response)) {
        return;
      }

      if (response.ok) {
        setEmail('');
        setFullName('');
        setNotes('');
        fetchLeads();
        notify({
          title: 'Offeree added',
          message: 'Offeree added and outreach email sent.',
          tone: 'success',
        });
      } else {
        const error = await response.json();
        notify({
          title: 'Offeree not added',
          message: error.error || 'Failed to add offeree.',
          tone: 'error',
        });
      }
    } catch (error) {
      console.error('Failed to add offeree:', error);
      notify({
        title: 'Offeree not added',
        message: 'Failed to add offeree.',
        tone: 'error',
      });
    } finally {
      setAdding(false);
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

  return (
    <div className="min-h-screen bg-futurex-bg">
      <header className="border-b border-futurex-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/">
            <div className="rounded-xl bg-[#fffdf8] px-3 py-2 shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
              <Image
                src="/futurex-wordmark-email.png"
                alt="FutureX"
                width={132}
                height={74}
                className="h-7 w-auto"
              />
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-futurex-gold">Admin Dashboard</div>
              <div className="text-xs text-futurex-muted">{adminEmail}</div>
            </div>
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              className="rounded-lg border border-futurex-line px-4 py-2 text-sm text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold disabled:opacity-50"
            >
              {loggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 rounded-lg border border-futurex-line bg-futurex-surface p-6">
          <h2 className="mb-4 text-2xl font-serif text-futurex-ink">
            Add Investor to Offeree Register
          </h2>
          <form onSubmit={addOfferee} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-futurex-muted">
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded border border-futurex-line bg-futurex-surface2 px-4 py-2 text-futurex-ink outline-none focus:border-futurex-gold"
                placeholder="investor@example.com"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-futurex-muted">
                Full Name (Optional)
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded border border-futurex-line bg-futurex-surface2 px-4 py-2 text-futurex-ink outline-none focus:border-futurex-gold"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-futurex-muted">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="w-full rounded border border-futurex-line bg-futurex-surface2 px-4 py-2 text-futurex-ink outline-none focus:border-futurex-gold"
                rows={2}
                placeholder="Source, referral details, etc."
              />
            </div>
            <button
              type="submit"
              disabled={adding}
              className="rounded bg-futurex-gold px-6 py-2 font-semibold text-futurex-bg hover:opacity-90 disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add & Send Outreach Email'}
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-futurex-line bg-futurex-surface p-6">
          <h2 className="mb-6 text-2xl font-serif text-futurex-ink">
            Investor Pipeline
          </h2>

          {loading ? (
            <p className="text-futurex-muted">Loading...</p>
          ) : leads.length === 0 ? (
            <p className="text-futurex-muted">
              No investors yet. Add one above to get started.
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
                                Team follow-up:
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
                          onClick={() => confirmPayment(lead.id)}
                          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                        >
                          Confirm Payment
                        </button>
                      ) : null}
                      {isAgreementStage(lead.stage) ? (
                        <Link
                          href={`/agreement/${lead.id}`}
                          className="rounded border border-futurex-line px-4 py-2 text-sm text-futurex-ink hover:border-futurex-gold hover:text-futurex-gold"
                        >
                          View Agreement
                        </Link>
                      ) : null}
                      <Link
                        href={`/chat/${lead.id}`}
                        className="rounded bg-futurex-gold px-4 py-2 text-sm text-futurex-bg hover:opacity-90"
                      >
                        View Chat
                      </Link>
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
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
