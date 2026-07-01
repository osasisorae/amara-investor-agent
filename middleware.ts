import { NextRequest, NextResponse } from 'next/server';
import { buildInvestorAccessPath } from '@/lib/chat/access-link';
import {
  ADMIN_SESSION_COOKIE,
  INVESTOR_SESSION_COOKIE,
} from '@/lib/security/session-cookies';
import {
  verifyAdminSessionToken,
  verifyInvestorSessionToken,
} from '@/lib/security/session-tokens';

const PROTECTED_INVESTOR_PAGE_PREFIXES = ['/chat/', '/agreement/'] as const;
const PROTECTED_INVESTOR_API_PREFIXES = [
  '/api/chat/',
  '/api/agreement/',
  '/api/kyc/',
  '/api/payment/',
] as const;

function buildUnauthorizedJsonResponse(
  message: string,
  status: number
): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

function buildInvestorAccessRedirect(
  request: NextRequest,
  pathname: string
): NextResponse {
  const redirectPath = buildInvestorAccessPath({
    reason: 'session_required',
    next: pathname,
  });

  return NextResponse.redirect(new URL(redirectPath, request.url));
}

function extractLeadId(
  pathname: string,
  prefixes: readonly string[]
): string | null {
  for (const prefix of prefixes) {
    if (!pathname.startsWith(prefix)) {
      continue;
    }

    const suffix = pathname.slice(prefix.length);
    const leadId = suffix.split('/')[0]?.trim();

    if (leadId) {
      return leadId;
    }
  }

  return null;
}

function isProtectedInvestorPagePath(pathname: string): boolean {
  return PROTECTED_INVESTOR_PAGE_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
}

function isProtectedInvestorApiPath(pathname: string): boolean {
  return PROTECTED_INVESTOR_API_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin/login' || pathname === '/api/admin/auth') {
    return NextResponse.next();
  }

  if (pathname === '/chat' || pathname === '/api/chat/access') {
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin/')) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const session = token ? await verifyAdminSessionToken(token) : null;

    if (session) {
      return NextResponse.next();
    }

    if (pathname.startsWith('/api/admin/')) {
      return buildUnauthorizedJsonResponse('Unauthorized', 401);
    }

    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  if (
    pathname === '/api/rates' ||
    isProtectedInvestorPagePath(pathname) ||
    isProtectedInvestorApiPath(pathname)
  ) {
    const token = request.cookies.get(INVESTOR_SESSION_COOKIE)?.value;
    const session = token ? await verifyInvestorSessionToken(token) : null;

    if (!session) {
      if (pathname === '/api/rates' || pathname.startsWith('/api/')) {
        return buildUnauthorizedJsonResponse('Unauthorized', 401);
      }

      return buildInvestorAccessRedirect(request, pathname);
    }

    if (pathname === '/api/rates') {
      return NextResponse.next();
    }

    const leadId = extractLeadId(pathname, [
      ...PROTECTED_INVESTOR_PAGE_PREFIXES,
      ...PROTECTED_INVESTOR_API_PREFIXES,
    ]);

    if (!leadId || session.leadId === leadId) {
      return NextResponse.next();
    }

    if (pathname.startsWith('/api/')) {
      return buildUnauthorizedJsonResponse('Forbidden', 403);
    }

    return buildInvestorAccessRedirect(request, pathname);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/agreement/:path*',
    '/chat/:path*',
    '/api/admin/:path*',
    '/api/agreement/:path*',
    '/api/chat/:path*',
    '/api/kyc/:path*',
    '/api/payment/:path*',
    '/api/rates',
  ],
};
