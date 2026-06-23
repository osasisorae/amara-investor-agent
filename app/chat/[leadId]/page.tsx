'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { markdownToHtml } from '@/lib/utils/markdown';

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

    // Optimistically add user message
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
        // Add agent response
        const agentMsg: Message = {
          id: `agent-${Date.now()}`,
          role: 'agent',
          content: data.message,
          created_at: Math.floor(Date.now() / 1000),
        };
        setMessages((prev) => [...prev, agentMsg]);

        // Update stage if changed
        if (data.stage && lead) {
          setLead({ ...lead, stage: data.stage });
        }
      } else {
        alert('Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
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
        alert(`${docType} uploaded successfully!`);
      } else {
        alert('Failed to upload document');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const completeKYC = async () => {
    if (uploadedDocs.length < 2) {
      alert('Please upload at least ID and proof of residence');
      return;
    }

    try {
      const response = await fetch(`/api/kyc/${leadId}/upload`, {
        method: 'PATCH',
      });

      if (response.ok) {
        alert('KYC submitted for review! Our compliance team will review within 24-48 hours.');
        if (lead) {
          setLead({ ...lead, stage: 'pending_human_review' });
        }
      }
    } catch (error) {
      console.error('Failed to complete KYC:', error);
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
      {/* Header */}
      <header className="border-b border-futurex-line bg-futurex-surface">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/futurex-wordmark-v3a.png"
              alt="FutureX"
              width={100}
              height={24}
              className="brightness-0 invert opacity-90"
            />
            <div className="border-l border-futurex-line pl-4">
              <div className="text-futurex-gold font-semibold text-sm">
                Amara
              </div>
              <div className="text-futurex-muted text-xs">
                Your Investment Guide
              </div>
            </div>
          </div>
          <div className="text-xs px-3 py-1 bg-futurex-gold-soft text-futurex-gold rounded-full border border-futurex-gold-border">
            {getStageDisplay(lead.stage)}
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-block bg-futurex-gold-soft border border-futurex-gold-border text-futurex-gold text-sm px-4 py-2 rounded-full mb-4">
                Welcome to FutureX
              </div>
              <h2 className="font-serif text-2xl text-futurex-ink mb-3">
                Hi, I'm Amara
              </h2>
              <p className="text-futurex-muted max-w-md mx-auto">
                I'm here to guide you through the FutureX investment process.
                Let's start by understanding if this opportunity is right for
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
                <div
                  className={`max-w-2xl rounded-lg px-5 py-3 ${
                    msg.role === 'investor'
                      ? 'bg-futurex-gold text-futurex-bg'
                      : 'bg-futurex-surface border border-futurex-line text-futurex-ink'
                  }`}
                >
                  {msg.role === 'agent' && (
                    <div className="text-xs text-futurex-gold mb-1 font-semibold">
                      Amara
                    </div>
                  )}
                  <div 
                    className="whitespace-pre-wrap markdown-content"
                    dangerouslySetInnerHTML={{ 
                      __html: msg.role === 'agent' 
                        ? markdownToHtml(msg.content)
                        : msg.content 
                    }}
                  />
                  <div
                    className={`text-xs mt-2 ${
                      msg.role === 'investor'
                        ? 'text-futurex-bg/70'
                        : 'text-futurex-muted'
                    }`}
                  >
                    {new Date(msg.created_at * 1000).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="border-t border-futurex-line bg-futurex-surface">
        <div className="max-w-4xl mx-auto px-6 py-4">
          {/* KYC Upload Section */}
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
