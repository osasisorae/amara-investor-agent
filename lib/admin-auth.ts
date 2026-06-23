import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';

export const ADMIN_SESSION_COOKIE = 'admin_session';

const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface AdminSession {
  email: string;
  role: 'admin';
}

function getAdminJwtSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET?.trim();

  if (!secret) {
    throw new Error('ADMIN_JWT_SECRET is not configured');
  }

  return new TextEncoder().encode(secret);
}

function getConfiguredAdminEmail(): string | null {
  const email = process.env.ADMIN_EMAIL?.trim();
  return email ? email.toLowerCase() : null;
}

async function decodeAdminSession(
  token: string
): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, getAdminJwtSecret(), {
      algorithms: ['HS256'],
    });

    if (typeof payload.email !== 'string' || payload.role !== 'admin') {
      return null;
    }

    const configuredAdminEmail = getConfiguredAdminEmail();
    if (
      configuredAdminEmail &&
      payload.email.trim().toLowerCase() !== configuredAdminEmail
    ) {
      return null;
    }

    return {
      email: payload.email,
      role: 'admin',
    };
  } catch {
    return null;
  }
}

export async function signAdminSession(
  session: AdminSession
): Promise<string> {
  return new SignJWT({
    email: session.email,
    role: session.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getAdminJwtSecret());
}

export async function verifyAdminSession(
  request: Pick<NextRequest, 'cookies'>
): Promise<AdminSession | null> {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return decodeAdminSession(token);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = cookies().get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return decodeAdminSession(token);
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
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
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
