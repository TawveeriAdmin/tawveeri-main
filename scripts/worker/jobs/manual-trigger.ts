// scripts/worker/jobs/manual-trigger.ts
//
// Consumer side of the admin "run now" delegation (see
// src/app/api/admin/scraping/schedules/[id]/run-now/route.ts). That route no
// longer executes anything itself — it enqueues a scraping_runs row with
// status='pending' and the request options in the existing `metadata`
// column. This job claims a small batch of those, runs them through the
// EXACT SAME ScrapingOrchestrator methods the scheduled price-update/
// discovery jobs use, and finishes the run normally.
//
// "Claiming" a row (pending -> running, stamping started_at) happens with a
// conditional UPDATE ... WHERE status='pending' so two workers racing on the
// same row cannot both execute it — belt-and-braces alongside the global
// advisory lock this job already only runs under.

import { createServerClient } from '../../../src/lib/database';
import { ScrapingOrchestrator } from '../../../src/lib/scraping/services/scraping-orchestrator';
import { finishRun, failRun } from '../../../src/lib/scraping/services/run-logger';
import type { PriceUpdateOptions, DiscoveryOptions } from '../../../src/lib/scraping/base/types';

const BATCH_SIZE = parseInt(process.env.WORKER_MANUAL_TRIGGER_BATCH || '5', 10);

interface PendingRow {
  id: number;
  store_name: string;
  store_id: number | null;
  job_type: 'discovery' | 'price_update';
  metadata: { options?: Record<string, unknown> } | null;
}

async function claim(supabase: ReturnType<typeof createServerClient>, id: number): Promise<boolean> {
  const { data, error } = await (supabase as any)
    .from('scraping_runs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id');
  if (error) { console.error(`[worker:manual-trigger] claim ${id} failed:`, error.message); return false; }
  return (data?.length ?? 0) > 0;
}

async function main() {
  const supabase = createServerClient();
  const { data: rows, error } = await (supabase as any)
    .from('scraping_runs')
    .select('id, store_name, store_id, job_type, metadata')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) throw new Error(`scraping_runs pending select failed: ${error.message}`);
  if (!rows || rows.length === 0) {
    console.log('[worker:manual-trigger] nothing pending');
    return;
  }

  console.log(`[worker:manual-trigger] found ${rows.length} pending manual request(s)`);
  const orchestrator = new ScrapingOrchestrator();

  for (const row of rows as PendingRow[]) {
    if (!(await claim(supabase, row.id))) {
      console.log(`[worker:manual-trigger] ${row.id}: already claimed elsewhere — skipping`);
      continue;
    }
    try {
      if (row.job_type === 'discovery') {
        const opts = row.metadata?.options || {};
        const options: DiscoveryOptions = { store_slug: row.store_name, ...opts };
        const result = await orchestrator.runDiscoveryJob(options, row.id);
        await finishRun({
          run_id: row.id,
          status: result.success ? (result.errors > 0 ? 'partial' : 'success') : 'failed',
          products_discovered: result.products_discovered,
          products_updated: result.products_linked,
          errors_count: result.errors,
          error_summary: result.error_messages?.length ? result.error_messages : undefined,
        });
        console.log(`[worker:manual-trigger] ${row.id} (${row.store_name}/discovery): discovered=${result.products_discovered} linked=${result.products_linked}`);
      } else {
        const opts = row.metadata?.options || {};
        const options: PriceUpdateOptions = { store_slug: row.store_name, max_products: 100, older_than_hours: 24, ...opts };
        const result = await orchestrator.runPriceUpdateJob(options);
        await finishRun({
          run_id: row.id,
          status: result.success ? (result.errors > 0 ? 'partial' : 'success') : 'failed',
          products_updated: result.products_updated,
          price_changes_detected: result.price_changes,
          errors_count: result.errors,
        });
        console.log(`[worker:manual-trigger] ${row.id} (${row.store_name}/price_update): updated=${result.products_updated} changes=${result.price_changes}`);
      }
    } catch (err) {
      console.error(`[worker:manual-trigger] ${row.id} threw:`, err instanceof Error ? err.message : err);
      await failRun(row.id, err);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[worker:manual-trigger] fatal:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
