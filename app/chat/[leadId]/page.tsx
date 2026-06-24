'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import type { ChatMessage } from '@/lib/chat/messages';
import type { LeadStage } from '@/lib/db/leads';
import type {
  AgreementReadyComponentData,
  DealBriefCardComponentData,
  DealCardComponentData,
  DocumentListComponentData,
  ExitCardComponentData,
  GuidedQuestionsComponentData,
  KycConsentComponentData,
  KycDocumentSelectorComponentData,
  KycPersonalDetailsComponentData,
  KycPromptComponentData,
  KycSubmittedComponentData,
  KycUploadComponentData,
  OwnershipCardComponentData,
  PipelineStatusComponentData,
  ReturnsTableComponentData,
  RevenueChartComponentData,
  RiskTableComponentData,
  SpvStructureCardComponentData,
  TimelineCardComponentData,
} from '@/lib/chat/components';
import { AgreementReadyCard } from '@/components/deal-room/AgreementReadyCard';
import { DealBriefCard } from '@/components/deal-room/DealBriefCard';
import { ExitCard } from '@/components/deal-room/ExitCard';
import { GuidedQuestionChips } from '@/components/deal-room/GuidedQuestionChips';
import { OwnershipCard } from '@/components/deal-room/OwnershipCard';
import { ReturnsTable } from '@/components/deal-room/ReturnsTable';
import { RevenueChart } from '@/components/deal-room/RevenueChart';
import { RiskTable } from '@/components/deal-room/RiskTable';
import { SPVStructureCard } from '@/components/deal-room/SPVStructureCard';
import { TimelineCard } from '@/components/deal-room/TimelineCard';
import { KYCConsentCard } from '@/components/deal-room/kyc/KYCConsentCard';
import { KYCDocumentSelectorCard } from '@/components/deal-room/kyc/KYCDocumentSelectorCard';
import { KYCPersonalDetailsCard } from '@/components/deal-room/kyc/KYCPersonalDetailsCard';
import { KYCSubmittedCard } from '@/components/deal-room/kyc/KYCSubmittedCard';
import { KYCUploadCardBoundary } from '@/components/deal-room/kyc/KYCUploadCardBoundary';
import { KYCUploadCard } from '@/components/deal-room/kyc/KYCUploadCard';
import { markdownToHtml } from '@/lib/utils/markdown';
import { useFeedback } from '@/components/feedback-provider';

interface Lead {
  id: string;
  email: string;
  stage: LeadStage;
  kyc_submitted_at?: number;
}

const DEFAULT_INPUT_PLACEHOLDER = 'Type your message...';

const INPUT_PLACEHOLDERS: Record<LeadStage, string> = {
  outreach_sent: "Tell Amara where you're based...",
  qualifying: "Tell Amara where you're based...",
  deal_room: 'Ask a question about the investment...',
  kyc_intake: 'Type your response...',
  pending_human_review: '',
  kyc_rejected: DEFAULT_INPUT_PLACEHOLDER,
  agreement_pending: 'Type your response...',
  agreement_signed: DEFAULT_INPUT_PLACEHOLDER,
  payment_pending: DEFAULT_INPUT_PLACEHOLDER,
  closed: DEFAULT_INPUT_PLACEHOLDER,
  disqualified: DEFAULT_INPUT_PLACEHOLDER,
};

const QUALIFICATION_PLACEHOLDERS = {
  investor_profile: "Tell Amara where you're based...",
  ticket_size: 'Type your response...',
  investment_horizon: 'Type your response...',
  kyc_willingness: 'Type your response...',
} as const;

function getStarterPrompts(stage: string): string[] {
  if (stage === 'agreement_pending') {
    return [
      "I'm ready to review and sign the agreement.",
      'What happens after I sign?',
    ];
  }

  if (stage === 'kyc_intake') {
    return [
      'What documents do you need from me?',
      "I'm ready to upload my KYC documents.",
    ];
  }

  if (stage === 'outreach_sent' || stage === 'qualifying') {
    return [
      "I'm based in London.",
      "I'm living and working outside Nigeria.",
      'Walk me through the process step by step.',
    ];
  }

  return [];
}

function renderDealCard(data: DealCardComponentData) {
  return (
    <div className="rounded-[24px] border border-futurex-gold-border bg-futurex-gold-soft/40 p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-futurex-gold">
        Deal Snapshot
      </div>
      <h3 className="mt-3 font-serif text-2xl text-futurex-ink">
        {data.spvName}
      </h3>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-futurex-muted">
            Target return
          </div>
          <div className="mt-2 text-sm leading-6 text-futurex-ink">
            {data.targetReturn}
          </div>
        </div>
        <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-futurex-muted">
            Hold period
          </div>
          <div className="mt-2 text-sm leading-6 text-futurex-ink">
            {data.holdPeriod}
          </div>
        </div>
        <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-futurex-muted">
            Minimum ticket
          </div>
          <div className="mt-2 text-sm leading-6 text-futurex-ink">
            {data.minimumTicket}
          </div>
        </div>
        <div className="rounded-2xl border border-futurex-line bg-futurex-surface2 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-futurex-muted">
            Exit strategy
          </div>
          <div className="mt-2 text-sm leading-6 text-futurex-ink">
            {data.exitStrategy}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderDocumentList(
  data: DocumentListComponentData,
  onSelect: (prompt: string) => void,
  disabled = false
) {
  return (
    <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5">
      <h3 className="font-serif text-2xl text-futurex-ink">{data.title}</h3>
      <p className="mt-3 text-sm leading-6 text-futurex-muted">
        {data.description}
      </p>
      <div className="mt-4 space-y-3">
        {data.documents.map((document) => (
          <button
            key={document.label}
            type="button"
            onClick={() => onSelect(document.triggerPrompt)}
            disabled={disabled}
            className="block w-full rounded-2xl border border-futurex-line bg-futurex-surface px-4 py-4 text-left transition hover:border-futurex-gold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="text-sm font-semibold text-futurex-ink">
              {document.label}
            </div>
            <div className="mt-2 text-sm leading-6 text-futurex-muted">
              {document.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function renderPipelineStatus(data: PipelineStatusComponentData) {
  const currentIndex = data.stages.findIndex(
    (stage) => stage.stage === data.currentStage
  );

  return (
    <div className="rounded-[24px] border border-futurex-line bg-futurex-surface2 p-5">
      <h3 className="font-serif text-2xl text-futurex-ink">{data.title}</h3>
      <p className="mt-3 text-sm leading-6 text-futurex-muted">
        {data.description}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data.stages.map((stage, index) => {
          const isActive = index === currentIndex;
          const isComplete = index < currentIndex;

          return (
            <div
              key={stage.stage}
              className={`rounded-2xl border px-3 py-3 text-center text-xs ${
                isActive
                  ? 'border-futurex-gold bg-futurex-gold-soft text-futurex-gold'
                  : isComplete
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-futurex-line bg-futurex-surface text-futurex-muted'
              }`}
            >
              <div className="font-semibold">{index + 1}</div>
              <div className="mt-1 leading-4">{stage.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const params = useParams();
  const leadId = params.leadId as string;
  const { notify } = useFeedback();
  const inputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasCompletedInitialScrollRef = useRef(false);
  const previousLatestMessageKeyRef = useRef<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lead, setLead] = useState<Lead | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [composerHeight, setComposerHeight] = useState(0);

  useEffect(() => {
    hasCompletedInitialScrollRef.current = false;
    previousLatestMessageKeyRef.current = null;
    setLoading(true);
    loadChat();
  }, [leadId]);

  useEffect(() => {
    const node = composerRef.current;

    if (!node) {
      return;
    }

    const updateComposerHeight = () => {
      setComposerHeight(node.offsetHeight);
    };

    updateComposerHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateComposerHeight);

      return () => {
        window.removeEventListener('resize', updateComposerHeight);
      };
    }

    const observer = new ResizeObserver(() => {
      updateComposerHeight();
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [loading]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const latestMessage = messages.at(-1);
    const latestMessageKey = latestMessage
      ? `${latestMessage.id}:${latestMessage.type}`
      : `empty:${messages.length}`;
    const isUiComponentMessage =
      latestMessage?.role === 'agent' && latestMessage.type !== 'text';
    const isInitialScroll = !hasCompletedInitialScrollRef.current;

    if (isInitialScroll) {
      hasCompletedInitialScrollRef.current = true;
    } else if (previousLatestMessageKeyRef.current === latestMessageKey) {
      return;
    }

    previousLatestMessageKeyRef.current = latestMessageKey;

    const timeout = window.setTimeout(
      () => {
        messagesEndRef.current?.scrollIntoView({
          behavior: isInitialScroll
            ? ('instant' as ScrollBehavior)
            : 'smooth',
          block: 'end',
        });
      },
      isUiComponentMessage ? 100 : 0
    );

    return () => window.clearTimeout(timeout);
  }, [loading, messages]);

  useEffect(() => {
    if (!lead || lead.stage !== 'pending_human_review') {
      return;
    }

    let cancelled = false;
    let polling = false;

    const pollMessages = async () => {
      if (cancelled || polling) {
        return;
      }

      polling = true;

      try {
        const response = await fetch(`/api/chat/${leadId}/messages`, {
          cache: 'no-store',
        });
        const data = await response.json();

        if (!response.ok) {
          console.error('Failed to poll chat messages:', data.error);
          return;
        }

        if (cancelled) {
          return;
        }

        const nextMessages = Array.isArray(data.messages) ? data.messages : [];
        const nextLead = data.lead || null;

        setMessages((current) => {
          const currentLastId = current.at(-1)?.id;
          const nextLastId = nextMessages.at(-1)?.id;

          if (
            current.length === nextMessages.length &&
            currentLastId === nextLastId
          ) {
            return current;
          }

          return nextMessages;
        });

        if (nextLead?.stage) {
          setLead((current) =>
            current
              ? current.stage === nextLead.stage &&
                (nextLead.kyc_submitted_at ?? current.kyc_submitted_at) ===
                  current.kyc_submitted_at
                ? current
                : {
                    ...current,
                    stage: nextLead.stage,
                    kyc_submitted_at:
                      nextLead.kyc_submitted_at ?? current.kyc_submitted_at,
                  }
              : current
          );
        }
      } catch (error) {
        console.error('Failed to poll chat messages:', error);
      } finally {
        polling = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void pollMessages();
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [lead?.stage, leadId]);

  const starterPrompts = useMemo(
    () => getStarterPrompts(lead?.stage || 'outreach_sent'),
    [lead?.stage]
  );
  const latestMessage = messages.at(-1);
  const shouldShowStarterPrompts = messages.length === 0;
  const shouldShowBinaryQuickReplies =
    latestMessage?.role === 'agent' &&
    latestMessage.metadata?.expectsBinaryResponse === true;

  const disableInput =
    sending ||
    lead?.stage === 'pending_human_review' ||
    lead?.stage === 'kyc_rejected';

  const loadChat = async () => {
    try {
      const response = await fetch(`/api/chat/${leadId}`);
      const data = await response.json();

      if (!response.ok) {
        notify({
          title: 'Chat unavailable',
          message: data.error || 'Failed to load chat.',
          tone: 'error',
        });
        return;
      }

      setMessages(data.messages || []);
      setLead(data.lead);
    } catch (error) {
      console.error('Failed to load chat:', error);
      notify({
        title: 'Chat unavailable',
        message: 'Failed to load chat.',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const applyStarterPrompt = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const submitMessage = async (rawMessage: string) => {
    if (!rawMessage.trim() || sending) {
      return;
    }

    const userMessage = rawMessage.trim();
    setInput('');
    setSending(true);

    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'investor',
      text: userMessage,
      type: 'text',
      createdAt: Math.floor(Date.now() / 1000),
    };

    setMessages((current) => [...current, tempUserMessage]);

    try {
      const response = await fetch(`/api/chat/${leadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessages((current) =>
          current.filter((message) => message.id !== tempUserMessage.id)
        );
        notify({
          title: 'Message not sent',
          message: data.error || 'Failed to send message.',
          tone: 'error',
        });
        return;
      }

      setMessages((current) => [...current, ...(data.messages || [])]);

      if (data.stage && lead) {
        setLead({ ...lead, stage: data.stage });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages((current) =>
        current.filter((message) => message.id !== tempUserMessage.id)
      );
      notify({
        title: 'Message not sent',
        message: 'Failed to send message.',
        tone: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    await submitMessage(input);
  };

  const uploadDocument = async (file: File, docType: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docType', docType);

      const response = await fetch(`/api/kyc/${leadId}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        notify({
          title: 'Upload failed',
          message: 'Failed to upload document.',
          tone: 'error',
        });
        return;
      }

      setUploadedDocs((current) => [...current, docType]);
      notify({
        title: 'Upload complete',
        message: `${docType} uploaded successfully.`,
        tone: 'success',
      });
    } catch (error) {
      console.error('Upload failed:', error);
      notify({
        title: 'Upload failed',
        message: 'Upload failed.',
        tone: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const completeKYC = async () => {
    if (uploadedDocs.length < 2) {
      notify({
        title: 'More documents needed',
        message: 'Please upload at least ID and proof of residence.',
        tone: 'info',
      });
      return;
    }

    try {
      const response = await fetch(`/api/kyc/${leadId}/upload`, {
        method: 'PATCH',
      });
      const data = await response.json();

      if (!response.ok) {
        notify({
          title: 'KYC not submitted',
          message: data.error || 'Failed to submit KYC for review.',
          tone: 'error',
        });
        return;
      }

      notify({
        title: 'KYC submitted',
        message:
          'KYC submitted for review. Our compliance team will review within 24-48 hours.',
        tone: 'success',
      });

      if (lead) {
        setLead({
          ...lead,
          stage: data.stage || 'pending_human_review',
          kyc_submitted_at: Math.floor(Date.now() / 1000),
        });
      }

      if (data.messages?.length) {
        setMessages((current) => [...current, ...data.messages]);
      }
    } catch (error) {
      console.error('Failed to complete KYC:', error);
      notify({
        title: 'KYC not submitted',
        message: 'Failed to complete KYC.',
        tone: 'error',
      });
    }
  };

  const getInputPlaceholder = () => {
    if (!lead) {
      return DEFAULT_INPUT_PLACEHOLDER;
    }

    const currentQualificationQuestion =
      latestMessage?.role === 'agent' &&
      typeof latestMessage.metadata?.qualificationQuestion === 'string'
        ? latestMessage.metadata.qualificationQuestion
        : null;

    if (
      currentQualificationQuestion &&
      currentQualificationQuestion in QUALIFICATION_PLACEHOLDERS
    ) {
      return QUALIFICATION_PLACEHOLDERS[
        currentQualificationQuestion as keyof typeof QUALIFICATION_PLACEHOLDERS
      ];
    }

    return INPUT_PLACEHOLDERS[lead.stage] ?? DEFAULT_INPUT_PLACEHOLDER;
  };

  const renderKycPrompt = (data: KycPromptComponentData) => {
    const isSubmitted =
      lead?.stage === 'pending_human_review' && Boolean(lead.kyc_submitted_at);
    const isActive = lead?.stage === 'kyc_intake';

    return (
      <div className="rounded-[24px] border border-futurex-gold-border bg-futurex-gold-soft/40 p-5">
        <h3 className="font-serif text-2xl text-futurex-ink">{data.title}</h3>
        <p className="mt-3 text-sm leading-6 text-futurex-muted">
          {data.description}
        </p>

        {isSubmitted ? (
          <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Your documents have been submitted and are now with compliance for
            review.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {data.requirements.map((requirement) => {
              const alreadyUploaded = uploadedDocs.includes(requirement.key);

              return (
                <label key={requirement.key} className="block">
                  <span className="text-sm text-futurex-muted">
                    {requirement.label}{' '}
                    {requirement.optional ? '(optional)' : ''}
                    {alreadyUploaded && ' ✓'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(event) =>
                      event.target.files?.[0] &&
                      uploadDocument(event.target.files[0], requirement.key)
                    }
                    disabled={uploading || alreadyUploaded || !isActive}
                    className="mt-1 block w-full text-sm text-futurex-muted file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-futurex-gold file:px-4 file:py-2 file:text-sm file:font-semibold file:text-futurex-bg disabled:opacity-50"
                  />
                </label>
              );
            })}
            <button
              type="button"
              onClick={completeKYC}
              disabled={!isActive || uploadedDocs.length < 2}
              className="mt-2 w-full rounded-full bg-futurex-gold px-4 py-3 text-sm font-semibold text-futurex-bg transition hover:opacity-90 disabled:opacity-50"
            >
              Submit KYC for review
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderAgentContent = (message: ChatMessage) => {
    if (message.type === 'text') {
      return (
        <div
          className="markdown-content whitespace-pre-wrap"
          dangerouslySetInnerHTML={{
            __html: markdownToHtml(message.text),
          }}
        />
      );
    }

    switch (message.type) {
      case 'deal_card':
        return renderDealCard(
          message.metadata?.data as DealCardComponentData
        );
      case 'agreement_ready':
        return (
          <AgreementReadyCard
            data={message.metadata?.data as AgreementReadyComponentData}
          />
        );
      case 'document_list':
        return renderDocumentList(
          message.metadata?.data as DocumentListComponentData,
          submitMessage,
          sending || disableInput
        );
      case 'pipeline_status':
        return renderPipelineStatus(
          message.metadata?.data as PipelineStatusComponentData
        );
      case 'kyc_prompt':
        return renderKycPrompt(
          message.metadata?.data as KycPromptComponentData
        );
      case 'kyc_consent':
        return (
          <KYCConsentCard
            leadId={leadId}
            data={message.metadata?.data as KycConsentComponentData}
            disabled={sending || disableInput}
            onSendPrompt={submitMessage}
          />
        );
      case 'kyc_personal_details':
        return (
          <KYCPersonalDetailsCard
            leadId={leadId}
            data={message.metadata?.data as KycPersonalDetailsComponentData}
            disabled={sending || disableInput}
            onSendPrompt={submitMessage}
          />
        );
      case 'kyc_document_selector':
        return (
          <KYCDocumentSelectorCard
            leadId={leadId}
            data={message.metadata?.data as KycDocumentSelectorComponentData}
            disabled={sending || disableInput}
            onSendPrompt={submitMessage}
          />
        );
      case 'kyc_upload':
        return (
          <KYCUploadCardBoundary>
            <KYCUploadCard
              leadId={leadId}
              data={message.metadata?.data as KycUploadComponentData}
              disabled={sending || disableInput}
              onSendPrompt={submitMessage}
            />
          </KYCUploadCardBoundary>
        );
      case 'kyc_submitted':
        return (
          <KYCSubmittedCard
            data={message.metadata?.data as KycSubmittedComponentData}
          />
        );
      case 'guided_questions':
        return (
          <GuidedQuestionChips
            data={message.metadata?.data as GuidedQuestionsComponentData}
            disabled={sending || disableInput}
            onSelect={submitMessage}
          />
        );
      case 'deal_brief':
        return (
          <DealBriefCard
            data={message.metadata?.data as DealBriefCardComponentData}
          />
        );
      case 'spv_structure':
        return (
          <SPVStructureCard
            data={message.metadata?.data as SpvStructureCardComponentData}
            disabled={sending || disableInput}
            onSendPrompt={submitMessage}
          />
        );
      case 'returns_table':
        return (
          <ReturnsTable
            data={message.metadata?.data as ReturnsTableComponentData}
          />
        );
      case 'revenue_chart':
        return (
          <RevenueChart
            data={message.metadata?.data as RevenueChartComponentData}
          />
        );
      case 'ownership_card':
        return (
          <OwnershipCard
            data={message.metadata?.data as OwnershipCardComponentData}
          />
        );
      case 'risk_table':
        return (
          <RiskTable data={message.metadata?.data as RiskTableComponentData} />
        );
      case 'timeline_card':
        return (
          <TimelineCard
            data={message.metadata?.data as TimelineCardComponentData}
          />
        );
      case 'exit_card':
        return (
          <ExitCard data={message.metadata?.data as ExitCardComponentData} />
        );
      default:
        return (
          <div
            className="markdown-content whitespace-pre-wrap"
            dangerouslySetInnerHTML={{
              __html: markdownToHtml(message.text),
            }}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-futurex-bg">
        <p className="text-futurex-muted">Loading...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex h-screen items-center justify-center bg-futurex-bg">
        <p className="text-futurex-muted">Chat not found</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-futurex-bg">
      <header className="shrink-0 border-b border-futurex-line bg-futurex-surface">
        <div className="mx-auto w-full max-w-4xl px-6 py-4">
          <Image
            src="/amara-wordmark-cropped.jpeg"
            alt="Amara"
            width={154}
            height={48}
            className="h-auto w-[132px] sm:w-[154px]"
          />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto overscroll-contain">
          <div
            className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-6 pt-8"
            style={{
              paddingBottom: composerHeight > 0 ? composerHeight + 32 : 200,
            }}
          >
            <div className="mt-auto space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === 'investor'
                      ? 'justify-end'
                      : 'justify-start'
                  }`}
                >
                  {message.role === 'agent' ? (
                    <div className="flex w-full max-w-4xl items-start gap-3">
                      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#fffdf8] shadow-[0_10px_22px_rgba(0,0,0,0.18)]">
                        <Image
                          src="/amara-icon-cropped.jpeg"
                          alt="Amara icon"
                          width={36}
                          height={36}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div
                        className={`rounded-2xl border border-futurex-line bg-futurex-surface px-5 py-4 text-futurex-ink ${
                          message.type === 'text'
                            ? 'max-w-2xl'
                            : 'w-full max-w-3xl'
                        }`}
                      >
                        <div className="mb-1 text-xs font-semibold text-futurex-gold">
                          Amara
                        </div>
                        {renderAgentContent(message)}
                        <div className="mt-2 text-xs text-futurex-muted">
                          {new Date(message.createdAt * 1000).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-2xl rounded-2xl bg-futurex-gold px-5 py-3 text-futurex-bg">
                      <div className="whitespace-pre-wrap">{message.text}</div>
                      <div className="mt-2 text-xs text-futurex-bg/70">
                        {new Date(message.createdAt * 1000).toLocaleTimeString()}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div
              ref={messagesEndRef}
              style={{
                scrollMarginBottom: `${
                  composerHeight > 0 ? composerHeight + 24 : 224
                }px`,
              }}
            />
          </div>
        </div>
      </main>

      <footer
        ref={composerRef}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-futurex-line bg-futurex-surface"
      >
        <div
          className="mx-auto w-full max-w-4xl px-6 pt-4"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
          }}
        >
          {shouldShowStarterPrompts && starterPrompts.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => applyStarterPrompt(prompt)}
                  className="rounded-full border border-futurex-line px-3 py-2 text-sm text-futurex-muted transition hover:border-futurex-gold hover:text-futurex-gold"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {shouldShowBinaryQuickReplies ? (
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => submitMessage('Yes')}
                disabled={sending}
                className="rounded-full border border-futurex-line px-4 py-2 text-sm text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold disabled:opacity-50"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => submitMessage('No')}
                disabled={sending}
                className="rounded-full border border-futurex-line px-4 py-2 text-sm text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold disabled:opacity-50"
              >
                No
              </button>
            </div>
          ) : null}

          <form onSubmit={sendMessage} className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={disableInput}
              placeholder={getInputPlaceholder()}
              className="flex-1 rounded-xl border border-futurex-line bg-futurex-surface2 px-4 py-3 text-futurex-ink outline-none transition placeholder:text-futurex-muted focus:border-futurex-gold disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={disableInput || !input.trim()}
              className="rounded-xl bg-futurex-gold px-6 py-3 font-semibold text-futurex-bg transition hover:opacity-90 disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
