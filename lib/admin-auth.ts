import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE_SECONDS,
} from '@/lib/security/session-cookies';
import {
  signAdminSessionToken,
  type AdminSession,
  verifyAdminSessionToken,
} from '@/lib/security/session-tokens';

export { ADMIN_SESSION_COOKIE };
export type { AdminSession };

export async function signAdminSession(
  session: AdminSession
): Promise<string> {
  return signAdminSessionToken(session);
}

export async function verifyAdminSession(
  request: Pick<NextRequest, 'cookies'>
): Promise<AdminSession | null> {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return verifyAdminSessionToken(token);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = cookies().get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return verifyAdminSessionToken(token);
}

export function setAdminSessionCookie(
  response: NextResponse,
  token: string
): void {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearAdminSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
}
