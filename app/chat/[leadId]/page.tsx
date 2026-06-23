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

export default function ChatPage() {
  const params = useParams();
  const leadId = params.leadId as string;
  const { notify } = useFeedback();

  const [messages, setMessages] = useState<Message[]>([]);
  const [lead, setLead] = useState<Lead | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
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
            <div className="rounded-full border border-futurex-gold-border bg-[#fffdf8] px-4 py-2 shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
              <Image
                src="/amara-wordmark-cropped.jpeg"
                alt="Amara"
                width={126}
                height={40}
                className="h-auto w-[104px] opacity-90 sm:w-[126px]"
              />
            </div>
            <div className="text-xs tracking-[0.18em] uppercase text-futurex-muted">
              by FutureX
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
            <div className="mx-auto max-w-xl rounded-[28px] border border-futurex-line bg-futurex-surface p-8 text-center shadow-[0_24px_64px_rgba(0,0,0,0.25)]">
              <div className="inline-block bg-futurex-gold-soft border border-futurex-gold-border text-futurex-gold text-sm px-4 py-2 rounded-full mb-4">
                Welcome to FutureX
              </div>
              <div className="mb-5 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#fffdf8] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
                  <Image
                    src="/amara-icon-cropped.jpeg"
                    alt="Amara icon"
                    width={48}
                    height={48}
                    className="h-12 w-12 object-cover"
                  />
                </div>
              </div>
              <h2 className="mb-2 font-serif text-2xl text-futurex-ink">Amara</h2>
              <div className="mb-4 text-[11px] tracking-[0.24em] uppercase text-futurex-muted">
                FutureX investor guide
              </div>
              <p className="text-futurex-muted max-w-md mx-auto">
                I&apos;m here to guide you through the FutureX investment process.
                Let&apos;s start by understanding if this opportunity is right for
                you.
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
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending || lead?.stage === 'pending_human_review'}
              placeholder={
                lead?.stage === 'pending_human_review'
                  ? 'Waiting for KYC review...'
                  : 'Type your message...'
              }
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
