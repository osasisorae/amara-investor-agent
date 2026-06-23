import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { execute, query, queryOne } from '@/lib/db/client';
import { createLead } from '@/lib/db/leads';
import { logAuditEvent } from '@/lib/db/audit';
import { sendEmail } from '@/lib/email/resend-client';
import { getOutreachEmailTemplate } from '@/lib/email/templates';

interface OffereeRegisterRow {
  id: string;
  activated: number;
}

export async function POST(request: NextRequest) {
  try {
    const { email, fullName, notes, addedBy } = await request.json();
    const normalizedEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail || !addedBy) {
      return NextResponse.json(
        { error: 'Email and addedBy are required' },
        { status: 400 }
      );
    }

    const existing = await queryOne<OffereeRegisterRow>(
      'SELECT id, activated FROM offeree_register WHERE email = ?',
      [normalizedEmail]
    );

    if (existing?.activated === 1) {
      return NextResponse.json(
        { error: 'Email already exists in offeree register' },
        { status: 400 }
      );
    }

    const id = existing?.id ?? nanoid();
    const now = Math.floor(Date.now() / 1000);

    if (existing) {
      await execute(
        `UPDATE offeree_register
         SET full_name = ?, notes = ?, added_by = ?, added_at = ?, activated = 0
         WHERE id = ?`,
        [fullName || null, notes || null, addedBy, now, id]
      );
    } else {
      await execute(
        `INSERT INTO offeree_register (id, email, full_name, notes, added_by, added_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, normalizedEmail, fullName || null, notes || null, addedBy, now]
      );
    }

    // Create lead and trigger outreach
    const lead = await createLead({ email: normalizedEmail, addedBy });

    // Log audit event
    await logAuditEvent({
      leadId: lead.id,
      eventType: 'outreach_sent',
      metadata: { added_by: addedBy },
    });

    // Send outreach email
    const chatLink = `${process.env.NEXT_PUBLIC_APP_URL}/chat/${lead.id}`;
    const emailTemplate = getOutreachEmailTemplate({
      investorEmail: normalizedEmail,
      chatLink,
    });

    try {
      await sendEmail({
        to: normalizedEmail,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
      });
    } catch (emailError) {
      console.error('Failed to send outreach email:', emailError);
      // Don't fail the request if email fails
    }

    // Mark as activated
    await execute(
      'UPDATE offeree_register SET activated = 1 WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      success: true,
      offeree: { id, email: normalizedEmail, fullName },
      lead: { id: lead.id, stage: lead.stage },
    });
  } catch (error) {
    console.error('Error adding offeree:', error);
    return NextResponse.json(
      { error: 'Failed to add offeree' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const offerees = await query(
      'SELECT * FROM offeree_register ORDER BY added_at DESC'
    );

    return NextResponse.json({ offerees });
  } catch (error) {
    console.error('Error fetching offerees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch offerees' },
      { status: 500 }
    );
  }
}
