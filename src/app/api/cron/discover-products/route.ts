import { NextRequest, NextResponse } from 'next/server';
import { ScrapingOrchestrator } from '@/lib/scraping/services/scraping-orchestrator';
import type { DiscoveryOptions } from '@/lib/scraping/base/types';

/**
 * POST /api/cron/discover-products
 * Product discovery job endpoint
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
    const options: DiscoveryOptions = {
      store_slug: body.store_slug || 'jarir',
      category: body.category,
      max_pages: body.max_pages || 10,
      dry_run: body.dry_run || false,
    };

    const orchestrator = new ScrapingOrchestrator();
    const result = await orchestrator.runDiscoveryJob(options);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in discover-products job:', error);
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
 * GET /api/cron/discover-products
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Product discovery endpoint',
  });
}






