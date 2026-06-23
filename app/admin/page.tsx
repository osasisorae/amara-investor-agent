'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
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

export default function AdminDashboard() {
  const { notify, confirm } = useFeedback();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [notes, setNotes] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const response = await fetch('/api/admin/leads');
      const data = await response.json();
      setLeads(data.leads || []);
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const addOfferee = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);

    try {
      const response = await fetch('/api/admin/offeree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          fullName,
          notes,
          addedBy: 'osasisorae@gmail.com', // In production: get from session
        }),
      });

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

  const approveKYC = async (leadId: string) => {
    if (
      !(await confirm({
        title: 'Approve KYC',
        message: 'Approve this KYC submission?',
        confirmLabel: 'Approve',
      }))
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/kyc/${leadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          approvedBy: 'osasisorae@gmail.com',
        }),
      });

      if (response.ok) {
        notify({
          title: 'KYC approved',
          message: 'The investor can now proceed to the agreement stage.',
          tone: 'success',
        });
        fetchLeads();
      } else {
        notify({
          title: 'Approval failed',
          message: 'Failed to approve KYC.',
          tone: 'error',
        });
      }
    } catch (error) {
      console.error('Failed to approve KYC:', error);
      notify({
        title: 'Approval failed',
        message: 'Failed to approve KYC.',
        tone: 'error',
      });
    }
  };

  const rejectKYC = async (leadId: string) => {
    if (
      !(await confirm({
        title: 'Reject KYC',
        message: 'Reject this KYC submission?',
        confirmLabel: 'Reject',
        tone: 'danger',
      }))
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/kyc/${leadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          approvedBy: 'osasisorae@gmail.com',
        }),
      });

      if (response.ok) {
        notify({
          title: 'KYC rejected',
          message: 'The investor has been marked as rejected.',
          tone: 'success',
        });
        fetchLeads();
      } else {
        notify({
          title: 'Rejection failed',
          message: 'Failed to reject KYC.',
          tone: 'error',
        });
      }
    } catch (error) {
      console.error('Failed to reject KYC:', error);
      notify({
        title: 'Rejection failed',
        message: 'Failed to reject KYC.',
        tone: 'error',
      });
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
          confirmedBy: 'osasisorae@gmail.com',
        }),
      });

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

  const deleteLead = async (leadId: string, email: string) => {
    if (
      !(await confirm({
        title: 'Delete lead',
        message: `Delete lead ${email}? This will remove all associated data and allow re-adding this email.`,
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
    if (lead.stage === 'pending_human_review' && !lead.kyc_submitted_at) {
      return 'bg-amber-100 text-amber-900';
    }

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
    if (lead.stage === 'pending_human_review' && !lead.kyc_submitted_at) {
      return 'team review';
    }

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
      {/* Header */}
      <header className="border-b border-futurex-line">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
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
          <div className="text-sm text-futurex-gold">Admin Dashboard</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Add Offeree Form */}
        <div className="bg-futurex-surface border border-futurex-line rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-serif text-futurex-ink mb-4">
            Add Investor to Offeree Register
          </h2>
          <form onSubmit={addOfferee} className="space-y-4">
            <div>
              <label className="block text-sm text-futurex-muted mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-futurex-surface2 border border-futurex-line rounded px-4 py-2 text-futurex-ink focus:border-futurex-gold outline-none"
                placeholder="investor@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-futurex-muted mb-2">
                Full Name (Optional)
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-futurex-surface2 border border-futurex-line rounded px-4 py-2 text-futurex-ink focus:border-futurex-gold outline-none"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm text-futurex-muted mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-futurex-surface2 border border-futurex-line rounded px-4 py-2 text-futurex-ink focus:border-futurex-gold outline-none"
                rows={2}
                placeholder="Source, referral details, etc."
              />
            </div>
            <button
              type="submit"
              disabled={adding}
              className="bg-futurex-gold text-futurex-bg px-6 py-2 rounded font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add & Send Outreach Email'}
            </button>
          </form>
        </div>

        {/* Leads Pipeline */}
        <div className="bg-futurex-surface border border-futurex-line rounded-lg p-6">
          <h2 className="text-2xl font-serif text-futurex-ink mb-6">
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
                  className="bg-futurex-surface2 border border-futurex-line rounded p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-futurex-ink font-semibold">
                          {lead.full_name || lead.email}
                        </h3>
                        <span
                          className={`text-xs px-3 py-1 rounded-full ${getStageColor(
                            lead
                          )}`}
                        >
                          {formatStageLabel(lead)}
                        </span>
                      </div>
                      <p className="text-sm text-futurex-muted">
                        {lead.email}
                      </p>
                      <p className="text-xs text-futurex-muted mt-1">
                        Added:{' '}
                        {new Date(lead.created_at * 1000).toLocaleDateString()}
                      </p>
                      {lead.country && (
                        <p className="text-xs text-futurex-muted mt-1">
                          Location: {lead.country}
                        </p>
                      )}
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
                          {lead.qualificationSummary?.investorProfile && (
                            <p className="text-futurex-muted">
                              <span className="text-futurex-ink font-medium">Profile:</span>{' '}
                              {lead.qualificationSummary.investorProfile}
                            </p>
                          )}
                          {lead.qualificationSummary?.investmentHorizon && (
                            <p className="text-futurex-muted">
                              <span className="text-futurex-ink font-medium">Horizon:</span>{' '}
                              {lead.qualificationSummary.investmentHorizon}
                            </p>
                          )}
                          {lead.qualificationSummary?.ticketSize && (
                            <p className="text-futurex-muted">
                              <span className="text-futurex-ink font-medium">Ticket:</span>{' '}
                              {lead.qualificationSummary.ticketSize}
                            </p>
                          )}
                          {lead.qualificationSummary?.kycWillingness && (
                            <p className="text-futurex-muted">
                              <span className="text-futurex-ink font-medium">KYC:</span>{' '}
                              {lead.qualificationSummary.kycWillingness}
                            </p>
                          )}
                          {lead.qualificationSummary?.disqualificationReason && (
                            <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-rose-200">
                              <span className="font-medium">Not a fit:</span>{' '}
                              {lead.qualificationSummary.disqualificationReason}
                            </div>
                          )}
                          {lead.qualificationSummary?.futureInterestNote && (
                            <div className="rounded-lg border border-futurex-gold-border bg-futurex-gold-soft px-3 py-2 text-futurex-gold">
                              <span className="font-medium">Future interest:</span>{' '}
                              {lead.qualificationSummary.futureInterestNote}
                            </div>
                          )}
                          {lead.opsSummary?.humanReviewReason && (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-100">
                              <span className="font-medium">Team follow-up:</span>{' '}
                              {lead.opsSummary.humanReviewReason}
                            </div>
                          )}
                          {lead.opsSummary?.paymentReference && (
                            <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-indigo-100">
                              <span className="font-medium">Payment reference:</span>{' '}
                              {lead.opsSummary.paymentReference}
                            </div>
                          )}
                          {lead.opsSummary?.paymentConfirmedBy && (
                            <p className="text-futurex-muted">
                              <span className="text-futurex-ink font-medium">Payment confirmed by:</span>{' '}
                              {lead.opsSummary.paymentConfirmedBy}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {lead.stage === 'pending_human_review' &&
                        lead.kyc_submitted_at && (
                        <>
                          <button
                            onClick={() => approveKYC(lead.id)}
                            className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
                          >
                            Approve KYC
                          </button>
                          <button
                            onClick={() => rejectKYC(lead.id)}
                            className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700"
                          >
                            Reject KYC
                          </button>
                        </>
                      )}
                      {lead.stage === 'payment_pending' && (
                        <button
                          onClick={() => confirmPayment(lead.id)}
                          className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700"
                        >
                          Confirm Payment
                        </button>
                      )}
                      {isAgreementStage(lead.stage) && (
                        <Link
                          href={`/agreement/${lead.id}`}
                          className="border border-futurex-line px-4 py-2 rounded text-sm text-futurex-ink hover:border-futurex-gold hover:text-futurex-gold"
                        >
                          View Agreement
                        </Link>
                      )}
                      <Link
                        href={`/chat/${lead.id}`}
                        className="bg-futurex-gold text-futurex-bg px-4 py-2 rounded text-sm hover:opacity-90"
                      >
                        View Chat
                      </Link>
                      <button
                        onClick={() => deleteLead(lead.id, lead.email)}
                        className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700"
                        title="Delete lead and all data"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
