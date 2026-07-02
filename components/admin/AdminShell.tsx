'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface AdminShellProps {
  adminEmail: string;
  activePage: 'overview' | 'pipeline';
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}

function getNavLinkClasses(active: boolean): string {
  return active
    ? 'border-futurex-gold/40 bg-futurex-gold-soft text-futurex-gold'
    : 'border-futurex-line text-futurex-muted hover:border-futurex-gold hover:text-futurex-gold';
}

export function AdminShell({
  adminEmail,
  activePage,
  title,
  description,
  actions,
  children,
}: AdminShellProps) {
  const router = useRouter();

  const logout = async () => {
    try {
      await fetch('/api/admin/auth', {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to log out cleanly:', error);
    } finally {
      router.push('/admin/login');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-futurex-bg">
      <header className="border-b border-futurex-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <Link href="/">
              <div className="inline-flex rounded-xl bg-[#fffdf8] px-3 py-2 shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
                <Image
                  src="/futurex-wordmark-email.png"
                  alt="FutureX"
                  width={132}
                  height={74}
                  className="h-7 w-auto"
                />
              </div>
            </Link>

            <nav className="flex flex-wrap gap-2">
              <Link
                href="/admin"
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${getNavLinkClasses(
                  activePage === 'overview'
                )}`}
              >
                Efficiency
              </Link>
              <Link
                href="/admin/pipeline"
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${getNavLinkClasses(
                  activePage === 'pipeline'
                )}`}
              >
                Investor Pipeline
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-futurex-gold">Admin Dashboard</div>
              <div className="text-xs text-futurex-muted">{adminEmail}</div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-futurex-line px-4 py-2 text-sm text-futurex-ink transition hover:border-futurex-gold hover:text-futurex-gold"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.2em] text-futurex-gold">
              Amara Admin
            </div>
            <h1 className="mt-3 font-serif text-4xl text-futurex-ink">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-7 text-futurex-muted">
              {description}
            </p>
          </div>

          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>

        {children}
      </main>
    </div>
  );
}
