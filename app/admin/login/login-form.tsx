'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid email or password.');
        return;
      }

      router.push('/admin');
      router.refresh();
    } catch (loginError) {
      console.error('Admin login failed:', loginError);
      setError('Unable to sign in right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-futurex-bg px-6 py-10 text-futurex-ink">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-futurex-line bg-futurex-surface p-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="mb-8 flex justify-center">
            <div className="rounded-2xl bg-[#fffdf8] px-4 py-3 shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
              <Image
                src="/futurex-wordmark-email.png"
                alt="FutureX"
                width={148}
                height={56}
                className="h-8 w-auto"
                priority
              />
            </div>
          </div>

          <div className="mb-8 text-center">
            <h1 className="font-serif text-3xl text-futurex-ink">
              Admin Login
            </h1>
            <p className="mt-2 text-sm text-futurex-muted">
              Sign in to manage investors, KYC reviews, and payment confirmations.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm text-futurex-muted"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                className="w-full rounded-xl border border-futurex-line bg-futurex-surface2 px-4 py-3 text-futurex-ink outline-none transition focus:border-futurex-gold"
                placeholder="admin@investfuturex.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm text-futurex-muted"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-futurex-line bg-futurex-surface2 px-4 py-3 text-futurex-ink outline-none transition focus:border-futurex-gold"
                placeholder="Enter your password"
              />
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-futurex-gold px-4 py-3 font-semibold text-futurex-bg transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
