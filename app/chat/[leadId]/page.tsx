'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { markdownToHtml } from '@/lib/utils/markdown';
import { useFeedback } from '@/components/feedback-provider';

interface Message {
  id: string;
  role: 'agent' | 'investor';
  content: string;
  created_at: number;
}

interface Lead {
  id: string;
  email: string;
  stage: string;
}

interface QualificationState {
  currentQuestion:
    | 'investor_profile'
    | 'investment_horizon'
    | 'ticket_size'
    | 'kyc_willingness'
    | null;
  expectsBinaryResponse: boolean;
}

export default function ChatPage() {
  const params = useParams();
  const leadId = params.leadId as string;
  const { notify } = useFeedback();
  const inputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [lead, setLead] = useState<Lead | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [qualificationState, setQualificationState] =
    useState<QualificationState>({
      currentQuestion: null,
      expectsBinaryResponse: false,
    });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChat();
  }, [leadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChat = async () => {
    try {
      const response = await fetch(`/api/chat/${leadId}`);
      const data = await response.json();

      if (response.ok) {
        setMessages(data.messages || []);
        setLead(data.lead);
        setQualificationState(
          data.qualificationState || {
            currentQuestion: null,
            expectsBinaryResponse: false,
          }
        );
      }
    } catch (error) {
      console.error('Failed to load chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const applyStarterPrompt = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const submitMessage = async (rawMessage: string) => {
    if (!rawMessage.trim() || sending) return;

    const userMessage = rawMessage.trim();
    setInput('');
    setSending(true);

    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'investor',
      content: userMessage,
      created_at: Math.floor(Date.now() / 1000),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const response = await fetch(`/api/chat/${leadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await response.json();

      if (response.ok) {
        const agentMsg: Message = {
          id: `agent-${Date.now()}`,
          role: 'agent',
          content: data.message,
          created_at: Math.floor(Date.now() / 1000),
        };
        setMessages((prev) => [...prev, agentMsg]);

        if (data.stage && lead) {
          setLead({ ...lead, stage: data.stage });
        }
        setQualificationState(
          data.qualificationState || {
            currentQuestion: null,
            expectsBinaryResponse: false,
          }
        );
      } else {
        notify({
          title: 'Message not sent',
          message: data.error || 'Failed to send message.',
          tone: 'error',
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      notify({
        title: 'Message not sent',
        message: 'Failed to send message.',
        tone: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
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

      if (response.ok) {
        setUploadedDocs((prev) => [...prev, docType]);
        notify({
          title: 'Upload complete',
          message: `${docType} uploaded successfully.`,
          tone: 'success',
        });
      } else {
        notify({
          title: 'Upload failed',
          message: 'Failed to upload document.',
          tone: 'error',
        });
      }
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

      if (response.ok) {
        notify({
          title: 'KYC submitted',
          message:
            'KYC submitted for review. Our compliance team will review within 24-48 hours.',
          tone: 'success',
        });
        if (lead) {
          setLead({ ...lead, stage: 'pending_human_review' });
        }
      } else {
        notify({
          title: 'KYC not submitted',
          message: 'Failed to submit KYC for review.',
          tone: 'error',
        });
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

  const getStageDisplay = (stage: string) => {
    const stageMap: Record<string, string> = {
      outreach_sent: 'Welcome',
      qualifying: 'Qualification',
      deal_room: 'Deal Room',
      kyc_intake: 'KYC Submission',
      pending_human_review: 'KYC Under Review',
      agreement_pending: 'Agreement Ready',
      agreement_signed: 'Agreement Signed',
      disqualified: 'Not Qualified',
    };
    return stageMap[stage] || stage;
  };

  const starterPrompts: string[] = [];

  const getInputPlaceholder = () => {
    if (lead?.stage === 'pending_human_review') {
      return 'Waiting for KYC review...';
    }

    return 'Type your message...';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-futurex-bg flex items-center justify-center">
        <p className="text-futurex-muted">Loading...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-futurex-bg flex items-center justify-center">
        <p className="text-futurex-muted">Chat not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-futurex-bg flex flex-col">
      <header className="border-b border-futurex-line bg-futurex-surface">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Image
              src="/amara-wordmark-cropped.jpeg"
              alt="Amara"
              width={154}
              height={48}
              className="h-auto w-[132px] sm:w-[154px]"
            />
            <div className="hidden text-[11px] tracking-[0.2em] uppercase text-futurex-muted sm:block">
              Investor guide by FutureX
            </div>
          </div>
          <div className="text-xs px-3 py-1 bg-futurex-gold-soft text-futurex-gold rounded-full border border-futurex-gold-border">
            {getStageDisplay(lead.stage)}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          {messages.length === 0 ? (
            <div className="mx-auto max-w-2xl rounded-[28px] border border-futurex-line bg-futurex-surface p-12 text-center shadow-[0_24px_64px_rgba(0,0,0,0.25)]">
              <div className="mb-6 flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#fffdf8] shadow-[0_10px_22px_rgba(0,0,0,0.18)]">
                  <Image
                    src="/amara-icon-cropped.jpeg"
                    alt="Amara"
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
              <h2 className="mb-4 font-serif text-3xl text-futurex-ink">
                Hi, I&apos;m Amara
              </h2>
              <p className="mx-auto max-w-md text-lg text-futurex-muted leading-relaxed">
                I&apos;m here to help you understand if the Akwa Ibom Hospitality Vehicle is a good fit for you.
              </p>
              <p className="mx-auto mt-3 max-w-md text-futurex-muted">
                This takes about 2 minutes. Just tell me where you&apos;re based to get started.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === 'investor' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'agent' ? (
                  <div className="flex max-w-3xl items-start gap-3">
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#fffdf8] shadow-[0_10px_22px_rgba(0,0,0,0.18)]">
                      <Image
                        src="/amara-icon-cropped.jpeg"
                        alt="Amara icon"
                        width={36}
                        height={36}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="max-w-2xl rounded-2xl border border-futurex-line bg-futurex-surface px-5 py-4 text-futurex-ink">
                      <div className="mb-1 text-xs font-semibold text-futurex-gold">
                        Amara
                      </div>
                      <div
                        className="whitespace-pre-wrap markdown-content"
                        dangerouslySetInnerHTML={{
                          __html: markdownToHtml(msg.content),
                        }}
                      />
                      <div className="mt-2 text-xs text-futurex-muted">
                        {new Date(msg.created_at * 1000).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-2xl rounded-2xl bg-futurex-gold px-5 py-3 text-futurex-bg">
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    <div className="mt-2 text-xs text-futurex-bg/70">
                      {new Date(msg.created_at * 1000).toLocaleTimeString()}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="border-t border-futurex-line bg-futurex-surface">
        <div className="max-w-4xl mx-auto px-6 py-4">
          {lead?.stage === 'kyc_intake' && (
            <div className="mb-4 p-4 bg-futurex-surface2 border border-futurex-gold-border rounded-lg">
              <h3 className="text-futurex-gold font-semibold mb-3">Upload KYC Documents</h3>
              <div className="space-y-2">
                <label className="block">
                  <span className="text-sm text-futurex-muted">Government ID {uploadedDocs.includes('id') && '✓'}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => e.target.files?.[0] && uploadDocument(e.target.files[0], 'id')}
                    disabled={uploading || uploadedDocs.includes('id')}
                    className="block w-full text-sm text-futurex-muted mt-1
                      file:mr-4 file:py-2 file:px-4
                      file:rounded file:border-0
                      file:text-sm file:font-semibold
                      file:bg-futurex-gold file:text-futurex-bg
                      hover:file:opacity-90 file:cursor-pointer
                      disabled:opacity-50"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-futurex-muted">Proof of Residence {uploadedDocs.includes('residence') && '✓'}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => e.target.files?.[0] && uploadDocument(e.target.files[0], 'residence')}
                    disabled={uploading || uploadedDocs.includes('residence')}
                    className="block w-full text-sm text-futurex-muted mt-1
                      file:mr-4 file:py-2 file:px-4
                      file:rounded file:border-0
                      file:text-sm file:font-semibold
                      file:bg-futurex-gold file:text-futurex-bg
                      hover:file:opacity-90 file:cursor-pointer
                      disabled:opacity-50"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-futurex-muted">Proof of Funds (Optional) {uploadedDocs.includes('funds') && '✓'}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => e.target.files?.[0] && uploadDocument(e.target.files[0], 'funds')}
                    disabled={uploading || uploadedDocs.includes('funds')}
                    className="block w-full text-sm text-futurex-muted mt-1
                      file:mr-4 file:py-2 file:px-4
                      file:rounded file:border-0
                      file:text-sm file:font-semibold
                      file:bg-futurex-gold file:text-futurex-bg
                      hover:file:opacity-90 file:cursor-pointer
                      disabled:opacity-50"
                  />
                </label>
                {uploadedDocs.length >= 2 && (
                  <button
                    onClick={completeKYC}
                    className="w-full bg-green-600 text-white py-2 rounded font-semibold hover:bg-green-700 mt-2"
                  >
                    Submit KYC for Review
                  </button>
                )}
              </div>
            </div>
          )}

          <form onSubmit={sendMessage} className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending || lead?.stage === 'pending_human_review'}
              placeholder={getInputPlaceholder()}
              className="flex-1 bg-futurex-surface2 border border-futurex-line rounded px-4 py-3 text-futurex-ink placeholder-futurex-muted focus:border-futurex-gold outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={
                sending ||
                !input.trim() ||
                lead?.stage === 'pending_human_review'
              }
              className="bg-futurex-gold text-futurex-bg px-6 py-3 rounded font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
