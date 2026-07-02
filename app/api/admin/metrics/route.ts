import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getAgentEfficiencySnapshot } from '@/lib/analytics/agent-efficiency';

export const dynamic = 'force-dynamic';

function parseWindowDays(value: string | null): number {
  if (!value) {
    return 30;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error('windowDays must be a positive integer.');
  }

  return parsedValue;
}

export async function GET(request: NextRequest) {
  try {
    const session = await verifyAdminSession(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const windowDays = parseWindowDays(
      request.nextUrl.searchParams.get('windowDays')
    );
    const snapshot = await getAgentEfficiencySnapshot({ windowDays });

    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof Error && error.message.includes('windowDays')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error fetching admin metrics:', error);
    return NextResponse.json(
      { error: 'Failed to load admin metrics' },
      { status: 500 }
    );
  }
}
