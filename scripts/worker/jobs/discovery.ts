// scripts/worker/jobs/discovery.ts
//
// Direct replacement for scheduler.js's runDiscovery() loop (was an HTTP
// self-call per store×category to /api/cron/discover-products). Calls
// ScrapingOrchestrator.runDiscoveryJob directly — same business logic, same
// per-store overlap guard (hasActiveRun/reapStaleRuns from run-logger, which
// is DB-backed and therefore already correct regardless of trigger path).
//
// Category map and Samsung's wider max_pages override are copied verbatim
// from scripts/scheduler.js (see that file's own comments for the "why" on
// each — not re-derived here to avoid drifting from the reasoning already on
// record).

import { ScrapingOrchestrator } from '../../../src/lib/scraping/services/scraping-orchestrator';
import type { DiscoveryOptions } from '../../../src/lib/scraping/base/types';
import type { ProductCategory } from '../../../src/lib/database/types';
import { createServerClient } from '../../../src/lib/database';
import { startRun, finishRun, failRun, hasActiveRun, reapStaleRuns } from '../../../src/lib/scraping/services/run-logger';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const INGEST_CATEGORIES: Record<string, ProductCategory[]> = {
  shaker: ['tv', 'appliance', 'kitchen'] as ProductCategory[],
  samsung_ksa: ['smartphone', 'tablet', 'tv', 'monitor', 'audio', 'appliance', 'wearable', 'vacuum', 'accessories'] as ProductCategory[],
  swsg: ['tv', 'appliance', 'kitchen', 'smartphone'] as ProductCategory[],
  noon: ['smartphone', 'laptop', 'tv', 'tablet', 'audio', 'wearable', 'monitor', 'gaming', 'appliance', 'camera'] as ProductCategory[],
  lulu: ['smartphone', 'laptop', 'tv', 'tablet', 'audio', 'wearable', 'kitchen', 'appliance', 'monitor'] as ProductCategory[],
  sharafdg: ['smartphone', 'laptop', 'tv', 'tablet', 'audio', 'wearable', 'appliance', 'monitor', 'camera'] as ProductCategory[],
};

async function lookupStoreId(storeSlug: string): Promise<number | null> {
  const supabase = createServerClient();
  const { data } = await supabase.from('stores').select('id').eq('slug', storeSlug).maybeSingle();
  return (data as { id?: number } | null)?.id ?? null;
}

async function main() {
  const storesArg = process.env.WORKER_INGEST_STORES || '';
  const stores = storesArg.split(',').map((s) => s.trim()).filter(Boolean);
  if (!stores.length) {
    console.log('[worker:discovery] no stores configured — nothing to do');
    return;
  }
  const staggerMs = parseInt(process.env.WORKER_STAGGER_MS || '20000', 10);

  console.log(`[worker:discovery] starting — stores=[${stores.join(',')}]`);

  for (const slug of stores) {
    const categories = INGEST_CATEGORIES[slug] || (['tv'] as ProductCategory[]);
    for (const cat of categories) {
      const maxPages = slug === 'samsung_ksa'
        ? parseInt(process.env.SAMSUNG_DISCOVERY_MAX_PAGES || '18', 10)
        : 2;

      let runId: number | null = null;
      try {
        const storeId = await lookupStoreId(slug);
        await reapStaleRuns(storeId);
        if (storeId !== null && (await hasActiveRun(storeId))) {
          console.log(`[worker:discovery] ${slug}/${cat}: skipped — active run already in progress`);
          continue;
        }

        runId = await startRun({
          store_name: slug,
          store_id: storeId,
          job_type: 'discovery',
          triggered_by: 'schedule',
        });

        const options: DiscoveryOptions = { store_slug: slug, category: cat, max_pages: maxPages };
        const orchestrator = new ScrapingOrchestrator();
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
        console.log(`[worker:discovery] ${slug}/${cat}: discovered=${result.products_discovered} created=${result.products_created} linked=${result.products_linked}`);
      } catch (err) {
        console.error(`[worker:discovery] ${slug}/${cat} threw:`, err instanceof Error ? err.message : err);
        if (runId) await failRun(runId, err);
      }

      await sleep(staggerMs);
    }
  }

  console.log('[worker:discovery] done');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[worker:discovery] fatal:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
