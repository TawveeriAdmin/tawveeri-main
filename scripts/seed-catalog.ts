/**
 * Seed the catalog by firing per-(store, category) discovery calls with a
 * concurrency limit. Each HTTP request only processes one category per store
 * so we stay well inside the 300s Next.js route budget; across 5 parallel
 * requests we hit 5 different domains simultaneously (safe rate-wise).
 *
 * Usage:
 *   npx tsx scripts/seed-catalog.ts                        # all stores
 *   SEED_STORES=jarir,shaker npx tsx scripts/seed-catalog.ts
 *   SEED_MAX_PAGES=50 SEED_CONCURRENCY=3 npx tsx scripts/seed-catalog.ts
 */

import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
const CRON_SECRET = process.env.CRON_SECRET || '';
const MAX_PAGES = parseInt(process.env.SEED_MAX_PAGES || '100', 10);
const CONCURRENCY = parseInt(process.env.SEED_CONCURRENCY || '5', 10);
const PER_CALL_TIMEOUT_MS = parseInt(process.env.SEED_CALL_TIMEOUT_MS || '280000', 10);

const ALL_STORES = [
  'amazon', 'noon', 'jarir', 'extra', 'almanea', 'shaker', 'samsung_ksa', 'swsg',
];

const STORE_FILTER = (process.env.SEED_STORES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const STORES = STORE_FILTER.length > 0
  ? ALL_STORES.filter((s) => STORE_FILTER.includes(s))
  : ALL_STORES;

interface Job {
  store: string;
  category: string;
}

interface JobResult {
  store: string;
  category: string;
  ok: boolean;
  discovered?: number;
  created?: number;
  linked?: number;
  errors?: number;
  duration_ms?: number;
  run_id?: string;
  error_msg?: string;
}

const CONFIG_DIR = path.join(__dirname, '..', 'src', 'lib', 'scraping', 'config', 'store-configs');

/** Read the store's config, return its configured categories (only those with non-empty URLs). */
function categoriesForStore(store: string): string[] {
  const file = path.join(CONFIG_DIR, `${store}.json`);
  if (!fs.existsSync(file)) return [];
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  const urls = cfg.category_urls || {};
  return Object.entries(urls)
    .filter(([, v]) => Array.isArray(v) && (v as unknown[]).length > 0)
    .map(([k]) => k);
}

async function runOne(job: Job): Promise<JobResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/cron/discover-products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {}),
      },
      body: JSON.stringify({
        store_slug: job.store,
        category: job.category,
        max_pages: MAX_PAGES,
      }),
      signal: AbortSignal.timeout(PER_CALL_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ...job, ok: false, error_msg: `HTTP ${res.status}`, duration_ms: Date.now() - start };
    }
    const json = await res.json() as {
      success?: boolean;
      products_discovered?: number;
      products_created?: number;
      products_linked?: number;
      errors?: number;
      duration_ms?: number;
      run_id?: string;
    };
    return {
      store: job.store,
      category: job.category,
      ok: !!json.success,
      discovered: json.products_discovered ?? 0,
      created: json.products_created ?? 0,
      linked: json.products_linked ?? 0,
      errors: json.errors ?? 0,
      duration_ms: json.duration_ms ?? Date.now() - start,
      run_id: json.run_id,
    };
  } catch (err) {
    return {
      ...job,
      ok: false,
      error_msg: err instanceof Error ? err.message : String(err),
      duration_ms: Date.now() - start,
    };
  }
}

/** Worker pool: pops jobs off the queue until empty. */
async function runPool(queue: Job[]) {
  const results: JobResult[] = [];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) break;
      const stamp = new Date().toISOString().slice(11, 19);
      console.log(`[${stamp}] → ${job.store}/${job.category} (remaining=${queue.length})`);
      const r = await runOne(job);
      if (r.ok) {
        console.log(
          `[${new Date().toISOString().slice(11, 19)}] ✓ ${r.store}/${r.category} — discovered=${r.discovered} created=${r.created} linked=${r.linked} errors=${r.errors} (${Math.round((r.duration_ms ?? 0) / 1000)}s)`
        );
      } else {
        console.log(
          `[${new Date().toISOString().slice(11, 19)}] ✗ ${r.store}/${r.category} — ${r.error_msg} (${Math.round((r.duration_ms ?? 0) / 1000)}s)`
        );
      }
      results.push(r);
    }
  });
  await Promise.all(workers);
  return results;
}

(async () => {
  const jobs: Job[] = [];
  for (const store of STORES) {
    const categories = categoriesForStore(store);
    for (const cat of categories) jobs.push({ store, category: cat });
  }

  console.log('─'.repeat(70));
  console.log(`Stores: ${STORES.join(', ')}`);
  console.log(`Jobs: ${jobs.length} (store × category pairs)`);
  console.log(`Concurrency: ${CONCURRENCY} · Max pages: ${MAX_PAGES}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log('─'.repeat(70));
  console.log();

  const start = Date.now();
  const results = await runPool(jobs);
  const total = Date.now() - start;

  console.log();
  console.log('─'.repeat(70));
  console.log('SUMMARY');
  console.log('─'.repeat(70));

  const perStore: Record<string, { runs: number; discovered: number; errors: number; failed: number }> = {};
  for (const r of results) {
    const s = (perStore[r.store] ||= { runs: 0, discovered: 0, errors: 0, failed: 0 });
    s.runs += 1;
    s.discovered += r.discovered ?? 0;
    s.errors += r.errors ?? 0;
    if (!r.ok) s.failed += 1;
  }

  for (const store of STORES) {
    const s = perStore[store];
    if (!s) continue;
    const tag = s.failed > 0 ? '✗' : '✓';
    console.log(
      `  ${tag} ${store.padEnd(18)} discovered=${String(s.discovered).padStart(5)} runs=${s.runs} errors=${s.errors} failed=${s.failed}`
    );
  }

  console.log();
  console.log(`Total elapsed: ${Math.round(total / 1000)}s (${Math.round(total / 60000)}m)`);
})();
