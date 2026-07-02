'use client';

import { useEffect, useState } from 'react';

interface ReviewMessage {
  id: string;
  role: 'agent' | 'investor';
  content: string;
  createdAt: number;
  senderType: 'investor' | 'amara' | 'futurex_team';
  senderLabel: 'Investor' | 'Amara' | 'FutureX Team';
}

interface ChatSummary {
  headline: string;
  stageLabel: string;
  currentLocation: string | null;
  stageEnteredAt: number | null;
  timeInStageLabel: string;
  whyThisStage: string;
  suggestedNextStep: string;
  qualificationSignals: string[];
  latestInvestorMessagePreview: string | null;
  latestInvestorMessageAt: number | null;
}

interface ChatReviewData {
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
  chatSummary: ChatSummary;
  transcriptCount: number;
  messages: ReviewMessage[];
}

interface TranscriptResponse {
  transcript: ReviewMessage[];
  error?: string;
}

interface ChatReviewPanelProps {
  leadId: string;
  isOpen: boolean;
  onUnauthorized: (response: Response) => boolean;
}

function formatTimestamp(value: number | null) {
  if (!value) {
    return 'Not available';
  }

  return new Date(value * 1000).toLocaleString();
}

export function ChatReviewPanel({
  leadId,
  isOpen,
  onUnauthorized,
}: ChatReviewPanelProps) {
  const [data, setData] = useState<ChatReviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState('');
  const [transcript, setTranscript] = useState<ReviewMessage[] | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      setData(null);
      setShowTranscript(false);
      setTranscript(null);
      setTranscriptError('');

      try {
        const response = await fetch(`/api/admin/leads/${leadId}`, {
          cache: 'no-store',
        });

        if (onUnauthorized(response)) {
          return;
        }

        const payload = (await response.json()) as ChatReviewData & {
          error?: string;
        };

        if (!response.ok) {
          setError(payload.error || 'Failed to load chat review summary.');
          return;
        }

        setData(payload);
      } catch (loadError) {
        console.error('Failed to load chat review summary:', loadError);
        setError('Failed to load chat review summary.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isOpen, leadId, onUnauthorized]);

  const toggleTranscript = async () => {
    if (showTranscript) {
      setShowTranscript(false);
      return;
    }

    setShowTranscript(true);

    if (transcript || loadingTranscript) {
      return;
    }

    setLoadingTranscript(true);
    setTranscriptError('');

    try {
      const response = await fetch(`/api/admin/leads/${leadId}/transcript`, {
        cache: 'no-store',
      });

      if (onUnauthorized(response)) {
        return;
      }

      const payload = (await response.json()) as TranscriptResponse;

      if (!response.ok) {
        setTranscriptError(payload.error || 'Failed to load transcript.');
        return;
      }

      setTranscript(payload.transcript || []);
    } catch (loadError) {
      console.error('Failed to load chat transcript:', loadError);
      setTranscriptError('Failed to load transcript.');
    } finally {
      setLoadingTranscript(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="mt-4 rounded-2xl border border-futurex-line bg-futurex-surface p-4">
      <div className="space-y-5">
        <div>
          <div className="text-sm font-semibold text-futurex-ink">
            Chat summary
          </div>
          <div className="text-xs text-futurex-muted">
            Admin-only snapshot of the investor conversation. Open the
            transcript to verify the summary against the raw chat.
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 px-4 py-4 text-sm text-futurex-muted">
            Loading chat summary...
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
              <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
                  Investor snapshot
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
                    <span className="font-medium">Current stage:</span>{' '}
                    {data.chatSummary.stageLabel}
                  </div>
                  <div>
                    <span className="font-medium">Time in stage:</span>{' '}
                    {data.chatSummary.timeInStageLabel}
                  </div>
                  <div>
                    <span className="font-medium">Stage entered:</span>{' '}
                    {formatTimestamp(data.chatSummary.stageEnteredAt)}
                  </div>
                  <div>
                    <span className="font-medium">Location:</span>{' '}
                    {data.chatSummary.currentLocation || 'Not captured yet'}
                  </div>
                  {data.reviewRequest.open && data.reviewRequest.reason ? (
                    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-3 text-amber-100">
                      <span className="font-medium">Open follow-up:</span>{' '}
                      {data.reviewRequest.reason}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-futurex-muted">
                  Summary
                </div>
                <div className="mt-4 space-y-4 text-sm leading-6 text-futurex-muted">
                  <div className="rounded-2xl border border-futurex-gold-border bg-futurex-gold-soft px-4 py-3 text-futurex-ink">
                    {data.chatSummary.headline}
                  </div>

                  <div>
                    <div className="font-medium text-futurex-ink">
                      Why Amara put them here
                    </div>
                    <div className="mt-1">{data.chatSummary.whyThisStage}</div>
                  </div>

                  <div>
                    <div className="font-medium text-futurex-ink">
                      Suggested next step
                    </div>
                    <div className="mt-1">
                      {data.chatSummary.suggestedNextStep}
                    </div>
                  </div>

                  {data.chatSummary.qualificationSignals.length ? (
                    <div>
                      <div className="font-medium text-futurex-ink">
                        Qualification signals
                      </div>
                      <div className="mt-2 space-y-2">
                        {data.chatSummary.qualificationSignals.map((signal) => (
                          <div
                            key={signal}
                            className="rounded-2xl border border-futurex-line bg-futurex-surface px-3 py-2"
                          >
                            {signal}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {data.chatSummary.latestInvestorMessagePreview ? (
                    <div>
                      <div className="font-medium text-futurex-ink">
                        Latest investor message
                      </div>
                      <div className="mt-1 rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-3">
                        <div className="text-xs text-futurex-muted">
                          {formatTimestamp(
                            data.chatSummary.latestInvestorMessageAt
                          )}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-futurex-ink">
                          {data.chatSummary.latestInvestorMessagePreview}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-futurex-ink">
                    Verify against transcript
                  </div>
                  <div className="text-xs text-futurex-muted">
                    Open the raw conversation before acting on the summary if
                    you need direct evidence from the chat.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleTranscript}
                  className="rounded border border-futurex-line px-4 py-2 text-sm text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold"
                >
                  {showTranscript
                    ? 'Hide transcript'
                    : `Verify transcript (${data.transcriptCount})`}
                </button>
              </div>

              {showTranscript ? (
                <div className="mt-4">
                  {loadingTranscript ? (
                    <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4 text-sm text-futurex-muted">
                      Loading transcript...
                    </div>
                  ) : null}

                  {transcriptError ? (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
                      {transcriptError}
                    </div>
                  ) : null}

                  {transcript ? (
                    transcript.length ? (
                      <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
                        {transcript.map((message) => (
                          <div
                            key={message.id}
                            className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-futurex-ink">
                                {message.senderLabel}
                              </div>
                              <div className="text-xs text-futurex-muted">
                                {formatTimestamp(message.createdAt)}
                              </div>
                            </div>
                            <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-futurex-muted">
                              {message.content || '[Structured UI message]'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4 text-sm text-futurex-muted">
                        No transcript is available for this lead yet.
                      </div>
                    )
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
