import { NextRequest, NextResponse } from 'next/server';
import { dispatchDueSchedules } from '@/lib/scraping/services/schedule-dispatcher';

export const maxDuration = 60;

/**
 * POST /api/cron/dispatch
 * Called every minute by the PM2 scheduler process. Reads due scraping_schedules
 * and fires off the appropriate per-store cron routes.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await dispatchDueSchedules();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[dispatch] failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Scraping dispatcher endpoint',
  });
}
