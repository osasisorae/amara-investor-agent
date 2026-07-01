import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { getRequiredJwtSecretBytes } from '@/lib/security/env';

export const INVESTOR_SESSION_COOKIE = 'investor_session';

const INVESTOR_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const INVESTOR_JWT_SECRET = getRequiredJwtSecretBytes('INVESTOR_JWT_SECRET');

export interface InvestorSession {
  leadId: string;
  email: string;
  role: 'investor';
}

function getInvestorJwtSecret(): Uint8Array {
  return INVESTOR_JWT_SECRET;
}

async function decodeInvestorSession(
  token: string
): Promise<InvestorSession | null> {
  try {
    const { payload } = await jwtVerify(token, getInvestorJwtSecret(), {
      algorithms: ['HS256'],
    });

    if (
      typeof payload.leadId !== 'string' ||
      typeof payload.email !== 'string' ||
      payload.role !== 'investor'
    ) {
      return null;
    }

    return {
      leadId: payload.leadId,
      email: payload.email,
      role: 'investor',
    };
  } catch {
    return null;
  }
}

export async function signInvestorSession(
  session: InvestorSession
): Promise<string> {
  return new SignJWT({
    leadId: session.leadId,
    email: session.email,
    role: session.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getInvestorJwtSecret());
}

export async function verifyInvestorSession(
  request: Pick<NextRequest, 'cookies'>,
  expectedLeadId?: string
): Promise<InvestorSession | null> {
  const token = request.cookies.get(INVESTOR_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await decodeInvestorSession(token);

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

  return decodeInvestorSession(token);
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
    maxAge: INVESTOR_SESSION_MAX_AGE_SECONDS,
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
