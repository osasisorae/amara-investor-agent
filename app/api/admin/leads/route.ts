import { NextResponse } from 'next/server';
import { getAllLeads } from '@/lib/db/leads';
import { query } from '@/lib/db/client';

export async function GET() {
  try {
    const leads = await getAllLeads();

    // Get counts by stage
    const stageCounts = await query(`
      SELECT stage, COUNT(*) as count 
      FROM leads 
      GROUP BY stage
    `);

    return NextResponse.json({
      leads,
      stageCounts,
      total: leads.length,
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}
