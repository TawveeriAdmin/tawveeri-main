import { NextRequest, NextResponse } from 'next/server';
import { ScrapingOrchestrator } from '@/lib/scraping/services/scraping-orchestrator';
import type { DiscoveryOptions } from '@/lib/scraping/base/types';
import { createServerClient } from '@/lib/database';
import { startRun, finishRun, failRun } from '@/lib/scraping/services/run-logger';

// Self-hosted PM2 deployment — no Vercel runtime limit. 900s gives large
// categories (400+ products, 36+ listing pages) room to complete their
// sequential DB upserts without being killed mid-way.
export const maxDuration = 900;

/**
 * POST /api/cron/discover-products
 * Called either by the dispatcher (with run_id + schedule_id + store_id) or
 * manually (with store_slug + optional category).
 */
export async function POST(request: NextRequest) {
  let runId: string | null = null;

  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

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

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Product discovery endpoint',
  });
}
