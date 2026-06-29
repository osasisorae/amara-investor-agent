'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { isInvestorAccessNextPath } from '@/lib/chat/access-link';
import { useFeedback } from '@/components/feedback-provider';

const GENERIC_ACCESS_MESSAGE =
  "If your email is in our system, you'll receive an access code shortly.";

export default function ChatAccessPage() {
  const router = useRouter();
  const { notify } = useFeedback();
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [requestingCode, setRequestingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const prefilledEmail = searchParams.get('email')?.trim().toLowerCase();
    const accessReason = searchParams.get('reason');
    const next = searchParams.get('next');

    if (prefilledEmail) {
      setEmail((current) => current || prefilledEmail);
    }

    if (accessReason === 'session_required') {
      setStatusMessage((current) =>
        current || 'Verify your email to reopen your FutureX conversation.'
      );
    }

    if (isInvestorAccessNextPath(next)) {
      setNextPath(next);
    }
  }, []);

  const requestAccessCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      return;
    }

    setRequestingCode(true);
    try {
      const response = await fetch('/api/chat/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        notify({
          title: 'Access unavailable',
          message: data.error || 'Failed to send access code.',
          tone: 'error',
        });
        return;
      }

      setOtpRequested(true);
      setOtpCode('');
      setStatusMessage(data.message || GENERIC_ACCESS_MESSAGE);
    } catch (error) {
      console.error('Failed to request investor chat access:', error);
      notify({
        title: 'Access unavailable',
        message: 'Failed to send access code.',
        tone: 'error',
      });
    } finally {
      setRequestingCode(false);
    }
  };

  const verifyAccessCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !otpCode.trim()) {
      return;
    }

    setVerifyingCode(true);
    try {
      const response = await fetch('/api/chat/access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code: otpCode,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        notify({
          title: 'Code not accepted',
          message: data.error || 'Invalid or expired access code.',
          tone: 'error',
        });
        return;
      }

      router.push(nextPath || `/chat/${data.leadId}`);
    } catch (error) {
      console.error('Failed to verify investor chat access:', error);
      notify({
        title: 'Verification failed',
        message: 'Failed to verify access code.',
        tone: 'error',
      });
    } finally {
      setVerifyingCode(false);
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
            Enter the email address that received your FutureX outreach. We&apos;ll
            send a one-time access code to that inbox before reopening your
            Amara conversation.
          </p>

          <form onSubmit={requestAccessCode} className="mt-8 space-y-4">
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
              disabled={requestingCode || verifyingCode || !email.trim()}
              className="w-full rounded-full bg-futurex-gold px-4 py-3 font-semibold text-futurex-bg transition hover:opacity-90 disabled:opacity-50"
            >
              {requestingCode
                ? 'Sending code...'
                : otpRequested
                  ? 'Send another code'
                  : 'Send access code'}
            </button>
          </form>

          {statusMessage ? (
            <div className="mt-4 rounded-2xl border border-futurex-line bg-futurex-surface2 px-4 py-3 text-sm text-futurex-muted">
              {statusMessage}
            </div>
          ) : null}

          {otpRequested ? (
            <form onSubmit={verifyAccessCode} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm text-futurex-muted">
                  Access code
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                  className="w-full rounded-xl border border-futurex-line bg-futurex-surface2 px-4 py-3 text-futurex-ink outline-none transition focus:border-futurex-gold"
                  placeholder="Enter 6-digit code"
                />
              </label>
              <button
                type="submit"
                disabled={verifyingCode || !email.trim() || !otpCode.trim()}
                className="w-full rounded-full border border-futurex-line px-4 py-3 font-semibold text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold disabled:opacity-50"
              >
                {verifyingCode ? 'Verifying...' : 'Verify and continue'}
              </button>
            </form>
          ) : null}
        </div>
      </main>
    </div>
  );
}
