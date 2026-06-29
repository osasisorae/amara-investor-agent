'use client';

import { useEffect, useState } from 'react';
import { useFeedback } from '@/components/feedback-provider';

interface ReviewMessage {
  id: string;
  role: 'agent' | 'investor';
  content: string;
  createdAt: number;
  senderType?: 'investor' | 'amara' | 'futurex_team';
  senderLabel?: string;
}

interface SupportReviewData {
  lead: {
    id: string;
    email: string;
    fullName: string;
    stage: string;
    country: string;
  };
  reviewRequest: {
    open: boolean;
    reason: string | null;
    requestedAt: number | null;
    resolvedAt: number | null;
    resolvedBy: string | null;
  };
  messages: ReviewMessage[];
}

interface SupportReviewPanelProps {
  leadId: string;
  isOpen: boolean;
  onUnauthorized: (response: Response) => boolean;
  onComplete: () => void;
}

function formatTimestamp(value: number | null) {
  if (!value) {
    return 'Not available';
  }

  return new Date(value * 1000).toLocaleString();
}

function getPreviewMessageContent(message: ReviewMessage) {
  if (
    message.senderType === 'futurex_team' &&
    /^FutureX team:\s*/i.test(message.content)
  ) {
    return message.content.replace(/^FutureX team:\s*/i, '');
  }

  return message.content;
}

export function SupportReviewPanel({
  leadId,
  isOpen,
  onUnauthorized,
  onComplete,
}: SupportReviewPanelProps) {
  const { notify } = useFeedback();
  const [data, setData] = useState<SupportReviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [submittingAction, setSubmittingAction] = useState<
    'resolve' | 'reply' | null
  >(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/admin/leads/${leadId}`, {
          cache: 'no-store',
        });

        if (onUnauthorized(response)) {
          return;
        }

        const payload = (await response.json()) as SupportReviewData & {
          error?: string;
        };

        if (!response.ok) {
          setError(payload.error || 'Failed to load follow-up review details.');
          return;
        }

        setData(payload);
        setReplyMessage('');
      } catch (loadError) {
        console.error('Failed to load support review panel:', loadError);
        setError('Failed to load follow-up review details.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isOpen, leadId, onUnauthorized]);

  const markReviewed = async () => {
    if (submittingAction) {
      return;
    }

    setSubmittingAction('resolve');

    try {
      const response = await fetch(`/api/admin/leads/${leadId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'resolve_human_review',
        }),
      });

      if (onUnauthorized(response)) {
        return;
      }

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        notify({
          title: 'Review not updated',
          message: payload.error || 'Failed to mark follow-up as reviewed.',
          tone: 'error',
        });
        return;
      }

      notify({
        title: 'Follow-up resolved',
        message: 'The admin follow-up request has been marked as reviewed.',
        tone: 'success',
      });
      setData(null);
      onComplete();
    } catch (resolveError) {
      console.error('Failed to resolve support review:', resolveError);
      notify({
        title: 'Review not updated',
        message: 'Failed to mark follow-up as reviewed.',
        tone: 'error',
      });
    } finally {
      setSubmittingAction(null);
    }
  };

  const sendReply = async () => {
    if (submittingAction) {
      return;
    }

    const message = replyMessage.trim();

    if (!message) {
      notify({
        title: 'Reply required',
        message: 'Enter a reply before sending it to the investor.',
        tone: 'error',
      });
      return;
    }

    setSubmittingAction('reply');

    try {
      const response = await fetch(`/api/admin/leads/${leadId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send_human_review_reply',
          message,
        }),
      });

      if (onUnauthorized(response)) {
        return;
      }

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        notify({
          title: 'Reply not sent',
          message: payload.error || 'Failed to send reply to investor.',
          tone: 'error',
        });
        return;
      }

      notify({
        title: 'Reply sent',
        message:
          'The investor will see this reply in their chat and the follow-up request has been resolved.',
        tone: 'success',
      });
      setReplyMessage('');
      setData(null);
      onComplete();
    } catch (sendError) {
      console.error('Failed to send support reply:', sendError);
      notify({
        title: 'Reply not sent',
        message: 'Failed to send reply to investor.',
        tone: 'error',
      });
    } finally {
      setSubmittingAction(null);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
      <div className="space-y-5">
        <div>
          <div className="text-sm font-semibold text-amber-100">
            Admin follow-up request
          </div>
          <div className="text-xs text-amber-200/80">
            Amara flagged this investor conversation for human attention.
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-amber-500/20 bg-futurex-surface2 px-4 py-4 text-sm text-amber-100/80">
            Loading follow-up details...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {data ? (
          <>
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-2xl border border-amber-500/20 bg-futurex-surface2 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
                  Request summary
                </div>
                <div className="mt-4 space-y-3 text-sm text-futurex-ink">
                  <div>
                    <span className="font-medium">Investor:</span>{' '}
                    {data.lead.fullName || data.lead.email}
                  </div>
                  <div>
                    <span className="font-medium">Email:</span> {data.lead.email}
                  </div>
                  <div>
                    <span className="font-medium">Stage:</span>{' '}
                    {data.lead.stage.replace(/_/g, ' ')}
                  </div>
                  {data.lead.country ? (
                    <div>
                      <span className="font-medium">Location:</span>{' '}
                      {data.lead.country}
                    </div>
                  ) : null}
                  <div>
                    <span className="font-medium">Requested:</span>{' '}
                    {formatTimestamp(data.reviewRequest.requestedAt)}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
                  <div className="font-semibold">Reason</div>
                  <div className="mt-2 whitespace-pre-wrap leading-6">
                    {data.reviewRequest.reason || 'No reason recorded.'}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
                  Recent conversation
                </div>
                <div className="mt-4 max-h-[26rem] space-y-3 overflow-y-auto pr-1">
                  {data.messages.length ? (
                    data.messages.map((message) => (
                      <div
                        key={message.id}
                        className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-futurex-ink">
                            {message.senderLabel ||
                              (message.role === 'investor'
                                ? 'Investor'
                                : 'Amara')}
                          </div>
                          <div className="text-xs text-futurex-muted">
                            {formatTimestamp(message.createdAt)}
                          </div>
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-futurex-muted">
                          {getPreviewMessageContent(message) ||
                            '[Structured UI message]'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4 text-sm text-futurex-muted">
                      No conversation history available.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1 rounded-2xl border border-futurex-line bg-futurex-surface2 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
                  Reply in chat
                </div>
                <div className="mt-2 text-sm text-futurex-muted">
                  Send a direct team response into the investor conversation.
                  This also closes the open follow-up request.
                </div>
                <textarea
                  value={replyMessage}
                  onChange={(event) => setReplyMessage(event.target.value)}
                  rows={4}
                  maxLength={2000}
                  disabled={Boolean(submittingAction) || !data.reviewRequest.open}
                  className="mt-4 w-full rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-3 text-sm text-futurex-ink outline-none transition focus:border-futurex-gold disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Write the reply the investor should receive in chat."
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-futurex-muted">
                    {replyMessage.trim().length}/2000 characters
                  </div>
                  <button
                    type="button"
                    onClick={sendReply}
                    disabled={
                      Boolean(submittingAction) ||
                      !data.reviewRequest.open ||
                      !replyMessage.trim()
                    }
                    className="rounded bg-futurex-gold px-4 py-2 text-sm font-semibold text-futurex-bg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submittingAction === 'reply'
                      ? 'Sending...'
                      : 'Send Reply to Investor'}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={markReviewed}
                disabled={Boolean(submittingAction) || !data.reviewRequest.open}
                className="rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-futurex-bg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingAction === 'resolve' ? 'Marking...' : 'Mark Reviewed'}
              </button>
              {!data.reviewRequest.open && data.reviewRequest.resolvedAt ? (
                <div className="text-sm text-futurex-muted">
                  Resolved by {data.reviewRequest.resolvedBy || 'an admin'} on{' '}
                  {formatTimestamp(data.reviewRequest.resolvedAt)}.
                </div>
              ) : (
                <div className="text-sm text-futurex-muted">
                  Use this after reviewing the request and deciding how the team
                  will respond.
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
