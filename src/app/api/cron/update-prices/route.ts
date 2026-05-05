import { NextRequest, NextResponse } from 'next/server';
import { ScrapingOrchestrator } from '@/lib/scraping/services/scraping-orchestrator';
import type { PriceUpdateOptions } from '@/lib/scraping/base/types';
import { createServerClient } from '@/lib/database';
import { startRun, finishRun, failRun } from '@/lib/scraping/services/run-logger';

export const maxDuration = 300;

/**
 * POST /api/cron/update-prices
 * Called either by the dispatcher (with run_id + schedule_id + store_id) or
 * manually (with store_slug). When run_id is absent, one is created so the
 * run is still recorded in scraping_runs.
 */
export async function POST(request: NextRequest) {
  let runId: string | null = null;

  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
    }

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const options: PriceUpdateOptions = {
      store_slug: body.store_slug,
      max_products: body.max_products || 100,
      older_than_hours: body.older_than_hours || 24,
    };

    runId = body.run_id ?? null;

    // If no run_id was passed but we have a store_slug, create one so manual
    // invocations still appear in the history.
    if (!runId && options.store_slug) {
      const storeId = await lookupStoreId(options.store_slug);
      if (storeId) {
        runId = await startRun({
          store_id: storeId,
          job_type: 'price_update',
          schedule_id: body.schedule_id ?? null,
          triggered_by: body.schedule_id ? 'schedule' : 'manual',
          triggered_by_user_id: body.triggered_by_user_id ?? null,
        });
      }
    }

    const orchestrator = new ScrapingOrchestrator();
    const result = await orchestrator.runPriceUpdateJob(options);

    if (runId) {
      await finishRun({
        run_id: runId,
        status: result.success ? (result.errors > 0 ? 'partial' : 'success') : 'failed',
        products_updated: result.products_updated,
        price_changes_detected: result.price_changes,
        errors_count: result.errors,
      });
    }

    return NextResponse.json({ ...result, run_id: runId });
  } catch (error) {
    console.error('Error in update-prices job:', error);
    if (runId) {
      await failRun(runId, error);
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        run_id: runId,
      },
      { status: 500 }
    );
  }
}

async function lookupStoreId(storeSlug: string): Promise<string | null> {
  const supabase = createServerClient();
  const { data } = await supabase.from('stores').select('id').eq('slug', storeSlug).single();
  return (data as { id?: string } | null)?.id ?? null;
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Price update endpoint',
  });
}
