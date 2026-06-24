'use client';

import { useEffect, useState } from 'react';
import { useFeedback } from '@/components/feedback-provider';
import { humanizeStoredKycDocType } from '@/lib/kyc/config';

interface ReviewDocument {
  docType: string;
  filename: string;
  uploadedAt: number;
}

interface ReviewMessage {
  id: string;
  role: 'agent' | 'investor';
  content: string;
  createdAt: number;
}

interface ReviewData {
  lead: {
    id: string;
    email: string;
    stage: string;
  };
  personalDetails: {
    fullLegalName: string;
    dateOfBirth: string;
    nationality: string;
    countryOfResidence: string;
    phoneNumber: string;
    email: string;
  };
  documents: ReviewDocument[];
  messages: ReviewMessage[];
}

interface KycReviewPanelProps {
  leadId: string;
  leadEmail: string;
  isOpen: boolean;
  onToggle: () => void;
  onUnauthorized: (response: Response) => boolean;
  onComplete: () => void;
}

function isImageDocument(filename: string): boolean {
  return /\.(jpg|jpeg|png)$/i.test(filename);
}

export function KycReviewPanel({
  leadId,
  leadEmail,
  isOpen,
  onToggle,
  onUnauthorized,
  onComplete,
}: KycReviewPanelProps) {
  const { notify } = useFeedback();
  const [data, setData] = useState<ReviewData | null>(null);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConversation, setShowConversation] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState<
    'approved' | 'rejected' | null
  >(null);

  useEffect(() => {
    if (!isOpen || data || loading) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/admin/kyc/${leadId}`, {
          cache: 'no-store',
        });

        if (onUnauthorized(response)) {
          return;
        }

        const payload = (await response.json()) as ReviewData & { error?: string };

        if (!response.ok) {
          setError(payload.error || 'Failed to load KYC review details.');
          return;
        }

        setData(payload);

        const documentUrlEntries = await Promise.all(
          (payload.documents || []).map(async (document) => {
            const urlResponse = await fetch(
              `/api/admin/kyc/${leadId}/document-url?filename=${encodeURIComponent(
                document.filename
              )}`,
              { cache: 'no-store' }
            );

            if (onUnauthorized(urlResponse)) {
              return [document.filename, ''] as const;
            }

            const urlPayload = (await urlResponse.json()) as {
              url?: string;
            };

            return [document.filename, urlPayload.url || ''] as const;
          })
        );

        setDocumentUrls(Object.fromEntries(documentUrlEntries));
      } catch (loadError) {
        console.error('Failed to load KYC review panel:', loadError);
        setError('Failed to load KYC review details.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [data, isOpen, leadId, loading, onUnauthorized]);

  const submitDecision = async (decision: 'approved' | 'rejected') => {
    if (submittingDecision) {
      return;
    }

    if (decision === 'rejected' && !rejectReason.trim()) {
      notify({
        title: 'Reason required',
        message: 'Enter a reason before rejecting this KYC submission.',
        tone: 'error',
      });
      return;
    }

    setSubmittingDecision(decision);

    try {
      const response = await fetch(`/api/admin/kyc/${leadId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decision,
          reason: decision === 'rejected' ? rejectReason.trim() : undefined,
        }),
      });

      if (onUnauthorized(response)) {
        return;
      }

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        notify({
          title: 'Decision failed',
          message: payload.error || 'Failed to save KYC decision.',
          tone: 'error',
        });
        return;
      }

      notify({
        title: decision === 'approved' ? 'KYC approved' : 'KYC rejected',
        message:
          decision === 'approved'
            ? 'The investor can now proceed to the agreement stage.'
            : 'The investor has been sent back to KYC intake with your rejection reason.',
        tone: 'success',
      });

      setData(null);
      setDocumentUrls({});
      setRejectMode(false);
      setRejectReason('');
      onComplete();
    } catch (decisionError) {
      console.error('Failed to save KYC decision:', decisionError);
      notify({
        title: 'Decision failed',
        message: 'Failed to save KYC decision.',
        tone: 'error',
      });
    } finally {
      setSubmittingDecision(null);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-futurex-line bg-futurex-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-futurex-ink">
            Human review required
          </div>
          <div className="text-xs text-futurex-muted">{leadEmail}</div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-full border border-futurex-line px-4 py-2 text-sm text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold"
        >
          {isOpen ? 'Hide review' : 'Review KYC'}
        </button>
      </div>

      {isOpen ? (
        <div className="mt-4 space-y-5">
          {loading ? (
            <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 px-4 py-4 text-sm text-futurex-muted">
              Loading review details...
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          {data ? (
            <>
              <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
                  Investor summary
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-futurex-muted">
                      Full legal name
                    </div>
                    <div className="mt-1 text-sm text-futurex-ink">
                      {data.personalDetails.fullLegalName || 'Not provided'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-futurex-muted">
                      Email
                    </div>
                    <div className="mt-1 text-sm text-futurex-ink">
                      {data.personalDetails.email}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-futurex-muted">
                      Country of residence
                    </div>
                    <div className="mt-1 text-sm text-futurex-ink">
                      {data.personalDetails.countryOfResidence || 'Not provided'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-futurex-muted">
                      Phone number
                    </div>
                    <div className="mt-1 text-sm text-futurex-ink">
                      {data.personalDetails.phoneNumber || 'Not provided'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
                  Documents
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {data.documents.length ? (
                    data.documents.map((document) => {
                      const documentUrl = documentUrls[document.filename];
                      const label = humanizeStoredKycDocType(document.docType);

                      return (
                        <div
                          key={document.filename}
                          className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4"
                        >
                          <div className="text-sm font-semibold text-futurex-ink">
                            {label}
                          </div>
                          <div className="mt-1 text-xs text-futurex-muted">
                            Uploaded{' '}
                            {new Date(
                              document.uploadedAt * 1000
                            ).toLocaleString()}
                          </div>

                          {documentUrl ? (
                            isImageDocument(document.filename) ? (
                              <a
                                href={documentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 block"
                              >
                                <img
                                  src={documentUrl}
                                  alt={label}
                                  className="max-h-[200px] w-full rounded-xl border border-futurex-line object-cover"
                                />
                              </a>
                            ) : (
                              <a
                                href={documentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex rounded-full border border-futurex-line px-4 py-2 text-sm text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold"
                              >
                                View {label} -&gt;
                              </a>
                            )
                          ) : (
                            <div className="mt-3 text-sm text-futurex-muted">
                              Secure preview unavailable.
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4 text-sm text-futurex-muted lg:col-span-2">
                      No KYC documents have been uploaded yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
                    Conversation history
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowConversation((current) => !current)}
                    className="rounded-full border border-futurex-line px-3 py-1.5 text-xs text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold"
                  >
                    {showConversation ? 'Hide messages' : 'Show last 10'}
                  </button>
                </div>

                {showConversation ? (
                  <div className="mt-4 space-y-3">
                    {data.messages.length ? (
                      data.messages.map((message) => (
                        <div
                          key={message.id}
                          className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-futurex-gold">
                              {message.role}
                            </div>
                            <div className="text-xs text-futurex-muted">
                              {new Date(
                                message.createdAt * 1000
                              ).toLocaleString()}
                            </div>
                          </div>
                          <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-futurex-ink">
                            {message.content}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4 text-sm text-futurex-muted">
                        No conversation history available.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
                  Decision
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => submitDecision('approved')}
                    disabled={Boolean(submittingDecision)}
                    className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {submittingDecision === 'approved'
                      ? 'Approving...'
                      : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectMode((current) => !current)}
                    disabled={Boolean(submittingDecision)}
                    className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                  >
                    {rejectMode ? 'Cancel rejection' : 'Reject'}
                  </button>
                </div>

                {rejectMode ? (
                  <div className="mt-4 space-y-3">
                    <div className="text-sm text-futurex-muted">
                      Reason for rejection (required)
                    </div>
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      placeholder="Explain what needs to be corrected or resubmitted"
                      className="w-full rounded-xl border border-futurex-line bg-futurex-surface px-4 py-3 text-futurex-ink outline-none transition placeholder:text-futurex-muted focus:border-futurex-gold"
                    />
                    <button
                      type="button"
                      onClick={() => submitDecision('rejected')}
                      disabled={
                        Boolean(submittingDecision) || !rejectReason.trim()
                      }
                      className="rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:border-rose-400 hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      {submittingDecision === 'rejected'
                        ? 'Rejecting...'
                        : 'Confirm rejection'}
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
