'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useFeedback } from '@/components/feedback-provider';

export default function ChatAccessPage() {
  const router = useRouter();
  const { notify } = useFeedback();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/chat/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        notify({
          title: 'Access not found',
          message:
            data.error ||
            'We could not find an active conversation for that email address.',
          tone: 'error',
        });
        return;
      }

      router.push(`/chat/${data.leadId}`);
    } catch (error) {
      console.error('Failed to recover investor chat:', error);
      notify({
        title: 'Access unavailable',
        message: 'Failed to recover investor chat.',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-futurex-bg">
      <header className="border-b border-futurex-line bg-futurex-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <div className="rounded-2xl bg-[#fffdf8] px-3 py-2 shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
            <Image
              src="/amara-wordmark-cropped.jpeg"
              alt="Amara"
              width={154}
              height={48}
              className="h-auto w-[132px] sm:w-[154px]"
            />
          </div>
          <div className="rounded-full border border-futurex-gold-border bg-futurex-gold-soft px-3 py-1 text-xs font-semibold text-futurex-gold">
            Investor access
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-xl rounded-[32px] border border-futurex-line bg-futurex-surface p-10 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
          <div className="text-xs uppercase tracking-[0.22em] text-futurex-gold">
            Resume your conversation
          </div>
          <h1 className="mt-4 font-serif text-4xl text-futurex-ink">
            Open your investor chat
          </h1>
          <p className="mt-4 text-base leading-7 text-futurex-muted">
            Enter the email address that received your FutureX outreach. If
            you&apos;re already in the offeree register, we&apos;ll take you straight
            back to your Amara conversation.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm text-futurex-muted">
                Investor email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-futurex-line bg-futurex-surface2 px-4 py-3 text-futurex-ink outline-none transition focus:border-futurex-gold"
                placeholder="you@example.com"
              />
            </label>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full rounded-full bg-futurex-gold px-4 py-3 font-semibold text-futurex-bg transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Open my conversation'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
