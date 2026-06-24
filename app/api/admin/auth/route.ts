import { NextRequest, NextResponse } from 'next/server';
import {
  clearAdminSessionCookie,
  setAdminSessionCookie,
  signAdminSession,
} from '@/lib/admin-auth';

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    {
      status: 405,
      headers: {
        Allow: 'POST, DELETE',
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email =
      typeof body.email === 'string' ? normalizeEmail(body.email) : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim() || '';
    const configuredAdminPassword = process.env.ADMIN_PASSWORD || '';

    if (
      !configuredAdminEmail ||
      !configuredAdminPassword ||
      !process.env.ADMIN_JWT_SECRET?.trim()
    ) {
      return NextResponse.json(
        { error: 'Admin authentication is not configured correctly.' },
        { status: 500 }
      );
    }

    if (
      email !== normalizeEmail(configuredAdminEmail) ||
      password !== configuredAdminPassword
    ) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const session = {
      email: configuredAdminEmail,
      role: 'admin' as const,
    };
    const token = await signAdminSession(session);
    const response = NextResponse.json({
      success: true,
      session,
    });

    setAdminSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error('Admin login failed:', error);
    return NextResponse.json(
      { error: 'Failed to sign in.' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  clearAdminSessionCookie(response);
  return response;
}
