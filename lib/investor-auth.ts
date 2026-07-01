import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import {
  INVESTOR_SESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE_SECONDS,
} from '@/lib/security/session-cookies';
import {
  signInvestorSessionToken,
  type InvestorSession,
  verifyInvestorSessionToken,
} from '@/lib/security/session-tokens';

export { INVESTOR_SESSION_COOKIE };
export type { InvestorSession };

export async function signInvestorSession(
  session: InvestorSession
): Promise<string> {
  return signInvestorSessionToken(session);
}

export async function verifyInvestorSession(
  request: Pick<NextRequest, 'cookies'>,
  expectedLeadId?: string
): Promise<InvestorSession | null> {
  const token = request.cookies.get(INVESTOR_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await verifyInvestorSessionToken(token);

  if (!session) {
    return null;
  }

  if (expectedLeadId && session.leadId !== expectedLeadId) {
    return null;
  }

  return session;
}

export async function getInvestorSession(): Promise<InvestorSession | null> {
  const token = cookies().get(INVESTOR_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return verifyInvestorSessionToken(token);
}

export function setInvestorSessionCookie(
  response: NextResponse,
  token: string
): void {
  response.cookies.set({
    name: INVESTOR_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearInvestorSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: INVESTOR_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
}
