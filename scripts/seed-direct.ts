/**
 * Seed the catalog by calling the orchestrator DIRECTLY (not via the HTTP
 * route). This sidesteps Next.js's route `maxDuration` cap entirely — a large
 * category that takes 10 minutes to scrape + dedupe is fine.
 *
 * Usage:
 *   npx tsx scripts/seed-direct.ts                            # all stores
 *   SEED_STORES=jarir npx tsx scripts/seed-direct.ts          # one store
 *   SEED_STORES=jarir SEED_CATEGORIES=smartphone,tv npx ...   # specific categories
 *   SEED_MAX_PAGES=50 npx ...                                  # cap pages
 *   SCRAPING_SKIP_FUZZY=true npx ...                           # skip fuzzy match (faster)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

// Load env BEFORE importing anything from the project, because modules like
// src/lib/database/supabase.ts read env vars at import time and throw if
// they're missing.
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Skip fuzzy matching by default in bulk seed unless explicitly enabled.
if (process.env.SCRAPING_SKIP_FUZZY === undefined) {
  process.env.SCRAPING_SKIP_FUZZY = 'true';
}

// Skip price-history writes during initial bulk seed — there's no prior price
// to compare against, and skipping saves one DB round-trip per product.
if (process.env.SCRAPING_SKIP_PRICE_HISTORY === undefined) {
  process.env.SCRAPING_SKIP_PRICE_HISTORY = 'true';
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env vars. Expected NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Lazy-load the orchestrator so env vars are set first.
async function main() {
  const { ScrapingOrchestrator } = await import('../src/lib/scraping/services/scraping-orchestrator');

  const MAX_PAGES = parseInt(process.env.SEED_MAX_PAGES || '100', 10);
  const ALL_STORES = [
    'amazon', 'noon', 'jarir', 'extra', 'almanea', 'shaker', 'samsung_ksa', 'swsg',
  ];
  const STORES = (process.env.SEED_STORES || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const storesToRun = STORES.length > 0 ? STORES : ALL_STORES;

  // Amazon has the harshest rate-limit behaviour of all supported stores. When
  // the user explicitly targets only Amazon we assume they want the
  // conservative pacing defaults (concurrency=1, shuffled category order,
  // resume state) so repeated runs behave like idempotent top-ups instead of
  // re-racing the same angry-tail categories.
  const amazonOnly = storesToRun.length === 1 && storesToRun[0] === 'amazon';

  const CATEGORY_FILTER = (process.env.SEED_CATEGORIES || '')
    .split(',').map((s) => s.trim()).filter(Boolean);

  // Resume state: the seed run persists the list of categories that have
  // completed successfully per store. Re-running the same command skips
  // already-done categories. Useful both for crash recovery (Amazon 503 kills
  // the terminal mid-run) and for multi-night fills where the user wants the
  // command to be safely re-invokable.
  const SHUFFLE = (process.env.SEED_SHUFFLE ?? (amazonOnly ? 'true' : 'false')).toLowerCase() === 'true';
  const RESET_STATE = (process.env.SEED_RESET_STATE || 'false').toLowerCase() === 'true';
  const STATE_FILE_TEMPLATE = process.env.SEED_STATE_FILE || '';

  type SeedState = { completed: string[]; started_at: string };
  const stateFilePath = (store: string): string =>
    STATE_FILE_TEMPLATE
      ? STATE_FILE_TEMPLATE.replace(/\{store\}/g, store)
      : path.join(__dirname, '..', '.scrape-state', `${store}.json`);

  function loadState(store: string): SeedState {
    const file = stateFilePath(store);
    if (RESET_STATE || !fs.existsSync(file)) {
      return { completed: [], started_at: new Date().toISOString() };
    }
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        completed: Array.isArray(parsed?.completed) ? parsed.completed : [],
        started_at: typeof parsed?.started_at === 'string' ? parsed.started_at : new Date().toISOString(),
      };
    } catch {
      return { completed: [], started_at: new Date().toISOString() };
    }
  }

  function saveState(store: string, state: SeedState): void {
    const file = stateFilePath(store);
    const dir = path.dirname(file);
    try {
      fs.mkdirSync(dir, { recursive: true });
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
      fs.renameSync(tmp, file);
    } catch (err) {
      console.warn(`  [state] failed to persist ${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Fisher-Yates — unbiased permutation. Used so the same categories aren't
  // always the ones that run last (and therefore always get the angriest
  // rate-limit response).
  function shuffleInPlace<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const CONFIG_DIR = path.join(__dirname, '..', 'src', 'lib', 'scraping', 'config', 'store-configs');

  function categoriesForStore(store: string): string[] {
    const file = path.join(CONFIG_DIR, `${store}.json`);
    if (!fs.existsSync(file)) return [];
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    const urls = cfg.category_urls || {};
    let cats = Object.entries(urls)
      .filter(([, v]) => Array.isArray(v) && (v as unknown[]).length > 0)
      .map(([k]) => k);
    if (CATEGORY_FILTER.length > 0) {
      cats = cats.filter((c) => CATEGORY_FILTER.includes(c));
    }
    return cats;
  }

  const orchestrator = new ScrapingOrchestrator();
  const start = Date.now();
  // Amazon-only runs default to concurrency=1 — parallel categories multiply
  // the request rate against a single residential IP, which is exactly what
  // caused tail categories (kitchen/smart_home/monitor) to collapse in the
  // previous full-coverage run. Other multi-store runs keep the parallel
  // default so we don't regress their throughput.
  const DEFAULT_CONCURRENCY = amazonOnly ? 1 : 3;
  const CATEGORY_CONCURRENCY = parseInt(
    process.env.SEED_CATEGORY_CONCURRENCY || String(DEFAULT_CONCURRENCY),
    10,
  );
  const summary: Record<string, { runs: number; discovered: number; created: number; linked: number; errors: number; failed: number }> = {};
  const stamp = () => new Date().toISOString().slice(11, 19);

  async function runOneCategory(store: string, category: string, state?: SeedState) {
    const jobStart = Date.now();
    console.log(`[${stamp()}] → ${store}/${category}`);
    try {
      const result = await orchestrator.runDiscoveryJob({
        store_slug: store,
        category: category as any,
        max_pages: MAX_PAGES,
        // Per-category calls MUST skip the supplemental pass. The worker
        // pool fans out per category, so without this flag the supplemental
        // brand-page scrape would fire once PER category — multiplying
        // wall-clock by the category count. Supplemental runs once at the
        // end of each store via `runSupplementalOnce` below.
        skip_supplemental: true,
      });
      const elapsed = Math.round((Date.now() - jobStart) / 1000);
      summary[store].runs += 1;
      summary[store].discovered += result.products_discovered;
      summary[store].created += result.products_created;
      summary[store].linked += result.products_linked;
      summary[store].errors += result.errors;
      if (!result.success) summary[store].failed += 1;

      const status = result.success ? '✓' : '✗';
      console.log(
        `[${stamp()}] ${status} ${store}/${category} — discovered=${result.products_discovered} created=${result.products_created} linked=${result.products_linked} errors=${result.errors} (${elapsed}s)`
      );
      // Persist resume state on ANY finish (success or logical failure) so a
      // subsequent invocation doesn't re-scrape the category. If the category
      // genuinely needs retrying, the user can add SEED_RESET_STATE=true.
      if (state && !state.completed.includes(category)) {
        state.completed.push(category);
        saveState(store, state);
      }
      return;
    } catch (err) {
      const elapsed = Math.round((Date.now() - jobStart) / 1000);
      summary[store].failed += 1;
      summary[store].errors += 1;
      console.log(
        `[${stamp()}] ✗ ${store}/${category} — ${err instanceof Error ? err.message : String(err)} (${elapsed}s)`
      );
      // Hard failures (thrown exceptions) are NOT persisted — we want the
      // next run to retry them.
    }
  }

  async function runSupplementalOnce(store: string) {
    const jobStart = Date.now();
    console.log(`[${stamp()}] → ${store}/SUPPLEMENTAL`);
    try {
      const result = await orchestrator.runDiscoveryJob({
        store_slug: store,
        only_supplemental: true,
        max_pages: MAX_PAGES,
      });
      const elapsed = Math.round((Date.now() - jobStart) / 1000);
      summary[store].runs += 1;
      summary[store].discovered += result.products_discovered;
      summary[store].created += result.products_created;
      summary[store].linked += result.products_linked;
      summary[store].errors += result.errors;
      if (!result.success) summary[store].failed += 1;

      const status = result.success ? '✓' : '✗';
      console.log(
        `[${stamp()}] ${status} ${store}/SUPPLEMENTAL — discovered=${result.products_discovered} created=${result.products_created} linked=${result.products_linked} errors=${result.errors} (${elapsed}s)`
      );
    } catch (err) {
      const elapsed = Math.round((Date.now() - jobStart) / 1000);
      summary[store].failed += 1;
      summary[store].errors += 1;
      console.log(
        `[${stamp()}] ✗ ${store}/SUPPLEMENTAL — ${err instanceof Error ? err.message : String(err)} (${elapsed}s)`
      );
    }
  }

  for (const store of storesToRun) {
    const allCategories = categoriesForStore(store);
    if (allCategories.length === 0) {
      console.log(`\n[${stamp()}] skip ${store} (no categories configured)`);
      continue;
    }

    // Apply resume state + optional shuffle. Categories already in state are
    // skipped; remaining ones are optionally permuted so tail categories
    // rotate across runs.
    const state = loadState(store);
    const pending = allCategories.filter((c) => !state.completed.includes(c));
    const skipped = allCategories.length - pending.length;
    const categories = SHUFFLE ? shuffleInPlace([...pending]) : pending;

    if (categories.length === 0) {
      console.log(`\n[${stamp()}] skip ${store} (${allCategories.length} categor${allCategories.length === 1 ? 'y' : 'ies'} already completed per state file; SEED_RESET_STATE=true to re-run)`);
      continue;
    }

    const suffix = [
      `concurrency=${CATEGORY_CONCURRENCY}`,
      SHUFFLE ? 'shuffled' : null,
      skipped > 0 ? `resumed(+${skipped} done)` : null,
    ].filter(Boolean).join(', ');
    console.log(`\n${'─'.repeat(70)}\n${store.toUpperCase()} — ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'} (${suffix})\n${'─'.repeat(70)}`);
    summary[store] = { runs: 0, discovered: 0, created: 0, linked: 0, errors: 0, failed: 0 };

    // Run categories in parallel with a concurrency limit — each category has
    // its own scraper instance and rate limiter, so they're safe to fan out.
    // Default concurrency honours DEFAULT_CONCURRENCY (1 for amazon, 3 otherwise).
    const queue = [...categories];
    const workers = Array.from({ length: Math.min(CATEGORY_CONCURRENCY, categories.length) }, async () => {
      while (queue.length > 0) {
        const cat = queue.shift();
        if (!cat) break;
        await runOneCategory(store, cat, state);
      }
    });
    await Promise.all(workers);

    // After ALL categories for this store finish, run the supplemental pass
    // exactly once. Scrapers without a `discoverSupplementalProducts`
    // method (e.g. Amazon today) make this a cheap no-op.
    await runSupplementalOnce(store);
  }

  console.log(`\n${'─'.repeat(70)}\nSUMMARY\n${'─'.repeat(70)}`);
  for (const store of storesToRun) {
    const s = summary[store];
    if (!s) continue;
    const tag = s.failed > 0 ? '✗' : '✓';
    console.log(
      `  ${tag} ${store.padEnd(18)} discovered=${String(s.discovered).padStart(5)} created=${String(s.created).padStart(5)} linked=${String(s.linked).padStart(5)} runs=${s.runs} errors=${s.errors} failed=${s.failed}`
    );
  }
  const total = Date.now() - start;
  console.log(`\nTotal elapsed: ${Math.round(total / 1000)}s (${Math.round(total / 60000)}m)`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
