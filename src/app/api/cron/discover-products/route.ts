import { NextRequest, NextResponse } from 'next/server';
import { ScrapingOrchestrator } from '@/lib/scraping/services/scraping-orchestrator';
import type { DiscoveryOptions } from '@/lib/scraping/base/types';
import { createServerClient } from '@/lib/database';
import { startRun, finishRun, failRun } from '@/lib/scraping/services/run-logger';

export const maxDuration = 900;

export async function POST(request: NextRequest) {
  let runId: string | null = null;

  try {
    console.log("=== CRON DEBUG ===");
    console.log("Authorization:", request.headers.get("authorization"));
    console.log("Secret exists:", !!process.env.CRON_SECRET);
    console.log("Secret length:", process.env.CRON_SECRET?.length);
    console.log("Secret first4:", process.env.CRON_SECRET?.slice(0, 4));
    console.log("Header first10:", request.headers.get("authorization")?.slice(0, 10));

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
      if (storeId) {
        runId = await startRun({
          store_id: storeId,
          job_type: 'discovery',
          schedule_id: body.schedule_id ?? null,
          triggered_by: body.schedule_id ? 'schedule' : 'manual',
          triggered_by_user_id: body.triggered_by_user_id ?? null,
        });
      }
    }

    const orchestrator = new ScrapingOrchestrator();
    const result = await orchestrator.runDiscoveryJob(options);

    if (runId) {
      await finishRun({
        run_id: runId,
        status: result.success ? (result.errors > 0 ? 'partial' : 'success') : 'failed',
        products_discovered: result.products_discovered,
        products_updated: result.products_linked,
        errors_count: result.errors,
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

async function lookupStoreId(storeSlug: string): Promise<string | null> {
  const supabase = createServerClient();
  const { data } = await supabase.from('stores').select('id').eq('slug', storeSlug).single();
  return (data as { id?: string } | null)?.id ?? null;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const store = url.searchParams.get('store') || 'amazon';
  const pages = Number(url.searchParams.get('pages') || 1);
  const dry = url.searchParams.get('dry') !== 'false';

  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${process.env.CRON_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ store_slug: store, max_pages: pages, dry_run: dry }),
  });

  return POST(mockRequest);
}
