import { NextRequest, NextResponse } from 'next/server';
import { ScrapingOrchestrator } from '@/lib/scraping/services/scraping-orchestrator';
import type { DiscoveryOptions } from '@/lib/scraping/base/types';
import { createServerClient } from '@/lib/database';
import { startRun, finishRun, failRun, hasActiveRun, reapStaleRuns } from '@/lib/scraping/services/run-logger';

export const maxDuration = 900;

export async function POST(request: NextRequest) {
  let runId: number | null = null;

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
    const options: DiscoveryOptions = {
      store_slug: body.store_slug || 'jarir',
      category: body.category,
      categories: Array.isArray(body.categories) && body.categories.length > 0 ? body.categories : undefined,
      max_pages: body.max_pages || 10,
      dry_run: body.dry_run || false,
      skip_supplemental: body.skip_supplemental || false,
      only_supplemental: body.only_supplemental || false,
      mark_missing: body.mark_missing || false,
      stale_after_misses: body.stale_after_misses,
      out_of_stock_after_misses: body.out_of_stock_after_misses,
    };

    runId = body.run_id ?? null;

    if (!runId && !options.dry_run) {
      const storeId = await lookupStoreId(options.store_slug);

      // Reap BEFORE the overlap check, never after: a run row that was never closed
      // (process death, redeploy, request timeout) is indistinguishable from a live run
      // to `hasActiveRun`, so a corpse can skip this store for its whole window. Reaping
      // first means the guard only ever compares against runs that could still be alive.
      await reapStaleRuns(storeId);

      // Overlap protection: if this store already has a run in progress, skip
      // rather than double-scrape. The dispatcher supplies its own run_id, so
      // this guards only self-started (schedule/manual) runs.
      if (storeId !== null && (await hasActiveRun(storeId))) {
        return NextResponse.json({
          skipped: true,
          reason: 'active run in progress for this store',
          store_slug: options.store_slug,
        });
      }

      // store_name is logged as the canonical slug so runs are joinable
      // regardless of the display name a scraper happens to use.
      runId = await startRun({
        store_name: options.store_slug,
        store_id: storeId,
        job_type: 'discovery',
        schedule_id: body.schedule_id ?? null,
        triggered_by: body.schedule_id ? 'schedule' : 'manual',
        triggered_by_user_id: body.triggered_by_user_id ?? null,
      });
    }

    const orchestrator = new ScrapingOrchestrator();
    // Propagate the active scraping_runs.id so raw_observations written by the
    // ingestion service are linked to this run at insert time.
    const result = await orchestrator.runDiscoveryJob(options, runId);

    if (runId) {
      await finishRun({
        run_id: runId,
        status: result.success ? (result.errors > 0 ? 'partial' : 'success') : 'failed',
        products_discovered: result.products_discovered,
        products_updated: result.products_linked,
        errors_count: result.errors,
        error_summary: result.error_messages?.length ? result.error_messages : undefined,
      });
    }

    return NextResponse.json({ ...result, run_id: runId });
  } catch (error) {
    console.error('Error in discover-products job:', error);
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

async function lookupStoreId(storeSlug: string): Promise<number | null> {
  const supabase = createServerClient();
  const { data } = await supabase.from('stores').select('id').eq('slug', storeSlug).maybeSingle();
  return (data as { id?: number } | null)?.id ?? null;
}

/**
 * Read-only descriptor.
 *
 * SECURITY: this GET previously constructed a POST that injected the server's
 * own CRON_SECRET and ran a full discovery — an unauthenticated write trigger.
 * Discovery is a production write and must only run through the authenticated
 * POST below (Authorization: Bearer CRON_SECRET). GET performs no writes.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    route: '/api/cron/discover-products',
    method: 'POST required',
    auth: 'Authorization: Bearer <CRON_SECRET>',
    note: 'Discovery is a write operation; GET is read-only and cannot trigger ingestion.',
  });
}
