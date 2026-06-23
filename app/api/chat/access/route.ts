import { NextResponse } from 'next/server';
import { getLeadByEmail } from '@/lib/db/leads';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const lead = await getLeadByEmail(email);

    if (!lead) {
      return NextResponse.json(
        { error: 'No investor conversation was found for that email.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      leadId: lead.id,
    });
  } catch (error) {
    console.error('Error looking up investor chat:', error);
    return NextResponse.json(
      { error: 'Failed to look up investor chat' },
      { status: 500 }
    );
  }
}
