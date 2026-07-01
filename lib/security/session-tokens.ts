import { jwtVerify, SignJWT } from 'jose';
import {
  getRequiredEmailEnv,
  getRequiredJwtSecretBytes,
} from '@/lib/security/env-core';

export interface InvestorSession {
  leadId: string;
  email: string;
  role: 'investor';
}

export interface AdminSession {
  email: string;
  role: 'admin';
}

const ADMIN_JWT_SECRET = getRequiredJwtSecretBytes('ADMIN_JWT_SECRET');
const INVESTOR_JWT_SECRET = getRequiredJwtSecretBytes('INVESTOR_JWT_SECRET');
const CONFIGURED_ADMIN_EMAIL = getRequiredEmailEnv('ADMIN_EMAIL');

function getAdminJwtSecret(): Uint8Array {
  return ADMIN_JWT_SECRET;
}

function getInvestorJwtSecret(): Uint8Array {
  return INVESTOR_JWT_SECRET;
}

function getConfiguredAdminEmail(): string {
  return CONFIGURED_ADMIN_EMAIL;
}

export async function verifyInvestorSessionToken(
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

export async function signInvestorSessionToken(
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

export async function verifyAdminSessionToken(
  token: string
): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, getAdminJwtSecret(), {
      algorithms: ['HS256'],
    });

    if (typeof payload.email !== 'string' || payload.role !== 'admin') {
      return null;
    }

    if (payload.email.trim().toLowerCase() !== getConfiguredAdminEmail()) {
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

export async function signAdminSessionToken(
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
