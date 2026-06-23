import { NextRequest, NextResponse } from 'next/server';
import { execute, queryOne } from '@/lib/db/client';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;

    // Get lead email first
    const lead = await queryOne<{ email: string }>(
      'SELECT email FROM leads WHERE id = ?',
      [leadId]
    );

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Delete from all related tables (foreign keys should cascade, but let's be explicit)
    await execute('DELETE FROM messages WHERE lead_id = ?', [leadId]);
    await execute('DELETE FROM qualification_answers WHERE lead_id = ?', [leadId]);
    await execute('DELETE FROM kyc_documents WHERE lead_id = ?', [leadId]);
    await execute('DELETE FROM audit_events WHERE lead_id = ?', [leadId]);
    await execute('DELETE FROM otp_codes WHERE lead_id = ?', [leadId]);
    await execute('DELETE FROM leads WHERE id = ?', [leadId]);
    
    // Also delete from offeree register to allow re-adding
    await execute('DELETE FROM offeree_register WHERE email = ?', [lead.email]);

    return NextResponse.json({
      success: true,
      message: 'Lead and all associated data deleted',
      email: lead.email,
    });
  } catch (error) {
    console.error('Error deleting lead:', error);
    return NextResponse.json(
      { error: 'Failed to delete lead' },
      { status: 500 }
    );
  }
}
