import { NextRequest, NextResponse } from 'next/server';
import { ScrapingOrchestrator } from '@/lib/scraping/services/scraping-orchestrator';
import type { PriceUpdateOptions } from '@/lib/scraping/base/types';

/**
 * POST /api/cron/update-prices
 * Price update job endpoint
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const options: PriceUpdateOptions = {
      store_slug: body.store_slug,
      max_products: body.max_products || 100,
      older_than_hours: body.older_than_hours || 24,
    };

    const orchestrator = new ScrapingOrchestrator();
    const result = await orchestrator.runPriceUpdateJob(options);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in update-prices job:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/update-prices
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Price update endpoint',
  });
}






