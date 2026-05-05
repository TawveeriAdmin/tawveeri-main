/**
 * Seed Extra products by walking extra.com's sitemap.
 *
 * Extra's category pages are JS-rendered, which rules out the usual
 * discoverProducts() crawl (it requires Puppeteer and Puppeteer is
 * unreliable on this host). The sitemap at https://www.extra.com/sitemap.xml
 * is plain XML and lists every product URL, so we use it as the seed source.
 *
 * For each URL the script calls scraper.updateProductPrice(url), which in
 * the rewritten ExtraScraper parses the schema.org Product JSON-LD block in
 * the initial HTML response. That single fetch returns name, brand, sku,
 * price, availability, image, description, specifications, and merchant
 * rating — so createOrUpdateProduct() seeds AND enriches in one pass. No
 * separate enrich step needed for the initial load.
 *
 * Designed to be resumable across nights. The state file records the index
 * into the URL list so Ctrl-C or a crash picks up where we left off.
 *
 * Usage:
 *   # full seed (~27h at Extra's default 800-1500ms pacing)
 *   npx tsx scripts/seed-extra-sitemap.ts
 *
 *   # limit to N URLs per run
 *   SEED_LIMIT=5000 npx tsx scripts/seed-extra-sitemap.ts
 *
 *   # start over (discards state and URL cache)
 *   SEED_RESET_STATE=true npx tsx scripts/seed-extra-sitemap.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env vars. Expected NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

type SeedState = {
  /** Index into the URL list we're walking. */
  cursor: number;
  /** Running totals across resume sessions. */
  processed: number;
  created: number;
  updated: number;
  failed: number;
  failed_urls: string[];
  started_at: string;
  /** Cache key: when the sitemap fingerprint changes, reset cursor. */
  sitemap_fingerprint: string | null;
};

const SITEMAP_ROOT = 'https://www.extra.com/sitemap.xml';

async function main(): Promise<void> {
  const LIMIT = parseInt(process.env.SEED_LIMIT || '999999', 10);
  const RESUME = (process.env.SEED_RESUME ?? 'true').toLowerCase() === 'true';
  const RESET_STATE = (process.env.SEED_RESET_STATE || 'false').toLowerCase() === 'true';
  const STATE_FILE = process.env.SEED_STATE_FILE
    || path.join(__dirname, '..', '.scrape-state', 'extra-seed.json');
  const URL_CACHE_FILE = process.env.SEED_URL_CACHE
    || path.join(__dirname, '..', '.scrape-state', 'extra-urls.json');
  const COOLDOWN_MS = parseInt(process.env.SEED_COOLDOWN_MS || '120000', 10);
  const MAX_CONSECUTIVE_NULLS = parseInt(process.env.SEED_MAX_CONSECUTIVE_NULLS || '5', 10);
  // Prefer English-locale URLs so names + descriptions come back in English.
  // Arabic URLs still scrape fine; we rewrite /ar-sa/ → /en-sa/ for consistency.
  const FORCE_LOCALE = (process.env.SEED_FORCE_LOCALE || 'en-sa').toLowerCase();

  const { ExtraScraper } = await import('../src/lib/scraping/stores/extra-scraper');
  const { ProductService } = await import('../src/lib/scraping/services/product-service');
  const { createServerClient } = await import('../src/lib/database');

  const supabase = createServerClient();

  const { data: storeRow, error: storeErr } = await supabase
    .from('stores')
    .select('id')
    .eq('slug', 'extra')
    .single();
  if (storeErr || !storeRow) {
    console.error(`Could not resolve extra store: ${storeErr?.message || 'not found'}`);
    process.exit(1);
  }
  const extraStoreId = (storeRow as { id: string }).id;

  // ── Build or load URL list ───────────────────────────────────────────────
  const stamp = () => new Date().toISOString().slice(11, 19);
  let urls: string[] = [];
  let sitemapFingerprint = '';

  if (!RESET_STATE && fs.existsSync(URL_CACHE_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(URL_CACHE_FILE, 'utf8')) as {
        urls: string[]; fingerprint: string;
      };
      urls = Array.isArray(cached.urls) ? cached.urls : [];
      sitemapFingerprint = cached.fingerprint || '';
      console.log(`[${stamp()}] loaded cached URL list: ${urls.length} urls (fingerprint ${sitemapFingerprint.slice(0, 12)})`);
    } catch {
      urls = [];
    }
  }

  if (urls.length === 0) {
    console.log(`[${stamp()}] fetching sitemap index...`);
    const { urls: discovered, fingerprint } = await fetchAllProductUrls(SITEMAP_ROOT, FORCE_LOCALE);
    urls = discovered;
    sitemapFingerprint = fingerprint;
    fs.mkdirSync(path.dirname(URL_CACHE_FILE), { recursive: true });
    fs.writeFileSync(URL_CACHE_FILE, JSON.stringify({ urls, fingerprint }, null, 2));
    console.log(`[${stamp()}] cached ${urls.length} product URLs → ${URL_CACHE_FILE}`);
  }

  // ── Load state ───────────────────────────────────────────────────────────
  const state: SeedState = loadState(STATE_FILE, RESET_STATE);
  // If the sitemap regenerated significantly (different fingerprint), cursor
  // is probably garbage — warn the user, don't auto-reset. They can opt in
  // via SEED_RESET_STATE=true if they want.
  if (state.sitemap_fingerprint && state.sitemap_fingerprint !== sitemapFingerprint) {
    console.warn(
      `[${stamp()}] WARN: cached state was written against a different sitemap fingerprint.`
      + ` Set SEED_RESET_STATE=true if the cursor no longer lines up.`
    );
  }
  state.sitemap_fingerprint = sitemapFingerprint;

  const scraper = new ExtraScraper();
  const productService = new ProductService();

  let processedNow = 0;
  let consecutiveNulls = 0;
  let cooldownsHit = 0;
  const scriptStart = Date.now();

  console.log(
    `[${stamp()}] seed-extra-sitemap starting —`
    + ` total_urls=${urls.length} cursor=${state.cursor} limit=${LIMIT}`
    + ` (previously processed=${state.processed})`
  );

  try {
    for (; state.cursor < urls.length && processedNow < LIMIT; state.cursor++) {
      const url = urls[state.cursor];
      if (!url) continue;
      const rowStart = Date.now();
      try {
        const scraped = await scraper.updateProductPrice(url);
        if (!scraped) {
          state.failed++;
          state.failed_urls.push(url);
          consecutiveNulls++;
          console.log(`[${stamp()}] · [${state.cursor}] null after scrape (${Math.round((Date.now() - rowStart) / 1000)}s) — ${shortUrl(url)}`);
          if (consecutiveNulls >= MAX_CONSECUTIVE_NULLS) {
            cooldownsHit++;
            console.log(`[${stamp()}] ${consecutiveNulls} consecutive nulls → sleeping ${Math.round(COOLDOWN_MS / 1000)}s`);
            await sleep(COOLDOWN_MS);
            consecutiveNulls = 0;
          }
        } else {
          const { created } = await productService.createOrUpdateProduct(scraped, extraStoreId);
          if (created) state.created++;
          else state.updated++;
          consecutiveNulls = 0;
          console.log(
            `[${stamp()}] ${created ? '+' : '✓'} [${state.cursor}] ${shortCat(scraped.category)}`
            + ` ${shortName(scraped.name_en)}`
            + ` sar=${scraped.current_price}`
            + ` specs=${Object.keys(scraped.specifications || {}).length}`
            + ` (${Math.round((Date.now() - rowStart) / 1000)}s)`
          );
        }
      } catch (err) {
        state.failed++;
        state.failed_urls.push(url);
        console.log(`[${stamp()}] ✗ [${state.cursor}] ${err instanceof Error ? err.message : String(err)} — ${shortUrl(url)}`);
      }

      state.processed++;
      processedNow++;

      if (processedNow % 25 === 0) {
        saveState(STATE_FILE, state);
      }
    }
  } finally {
    saveState(STATE_FILE, state);
    await scraper.cleanup().catch(() => {});
  }

  const elapsed = Date.now() - scriptStart;
  console.log(`\n${'─'.repeat(70)}\nSEED SUMMARY\n${'─'.repeat(70)}`);
  console.log(
    `  processed_now=${processedNow}  created=${state.created}  updated=${state.updated}  failed=${state.failed}`
    + `  cooldowns=${cooldownsHit}  elapsed=${Math.round(elapsed / 60000)}m`
  );
  console.log(`  cursor=${state.cursor} / ${urls.length}  remaining=${Math.max(0, urls.length - state.cursor)}`);
  console.log(`  state → ${STATE_FILE}`);
}

// ── Sitemap ────────────────────────────────────────────────────────────────

async function fetchAllProductUrls(
  rootUrl: string,
  forceLocale: string,
): Promise<{ urls: string[]; fingerprint: string }> {
  const rootXml = await httpGet(rootUrl);
  const submapUrls = (rootXml.match(/<loc>([^<]+)<\/loc>/g) || [])
    .map((m) => m.replace(/<\/?loc>/g, ''))
    // Only the Product-* sub-sitemaps hold /p/ URLs; skip Main-* (store
    // finders, static pages) and facet-* (category pages).
    .filter((u) => /\/Product-/.test(u));

  console.log(`  sitemap index: ${submapUrls.length} Product sub-sitemaps`);

  const urlSet = new Set<string>();
  let skippedByCategory = 0;
  for (const smUrl of submapUrls) {
    try {
      const xml = await httpGet(smUrl);
      const locs = (xml.match(/<loc>([^<]+)<\/loc>/g) || []).map((m) => m.replace(/<\/?loc>/g, ''));
      for (const loc of locs) {
        if (!/\/p\/\d+/.test(loc)) continue;
        const normalized = forceLocaleOnUrl(loc, forceLocale);
        if (!isElectronicsUrl(normalized)) {
          skippedByCategory++;
          continue;
        }
        urlSet.add(normalized);
      }
    } catch (err) {
      console.warn(`  WARN: failed to fetch ${smUrl}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (skippedByCategory > 0) {
    console.log(`  filtered out ${skippedByCategory} non-electronics URLs (gift cards, services, perfume, etc.)`);
  }

  // Deterministic order: by product id (stable across sitemap regenerations).
  const urls = Array.from(urlSet).sort((a, b) => {
    const ai = extractProductId(a);
    const bi = extractProductId(b);
    return ai.localeCompare(bi);
  });

  const fingerprint = `count=${urls.length};first=${urls[0] || ''};last=${urls[urls.length - 1] || ''}`;
  return { urls, fingerprint };
}

function forceLocaleOnUrl(url: string, locale: string): string {
  return url
    .replace(/\/ar-sa\//i, `/${locale}/`)
    .replace(/\/ar(?=\/|$)/i, `/${locale}`);
}

/**
 * Allowlist check against the sitemap's top-level category segment.
 *
 * Tawveeri's scope is consumer electronics + home/kitchen appliances (same
 * as Amazon/Jarir's category_urls). Extra's sitemap is a flat product list
 * that also includes gift cards, extended warranties, perfume, toys,
 * musical instruments, etc. — none of which belong in the DB.
 *
 * Strategy: parse the path segment immediately after the locale prefix
 * (/en-sa/<segment>/...) and check it against a fixed allowlist. Anything
 * else is dropped before hitting the scraper.
 */
const EXTRA_ALLOWED_TOP_LEVEL = new Set([
  // Core electronics
  'mobiles-tablets',
  'computer',
  'accessories',
  'electronic-games',
  'electronics',
  'cameras',
  'audio',
  'video',
  'home-automation',
  'keyboards-and-mice',
  'input-d',
  'hp-gaming',
  // Appliances (Amazon's `appliance` + `kitchen` scope)
  'small-appliances',
  'white-goods',
  'whitegoods-accessories',
]);

function isElectronicsUrl(url: string): boolean {
  const match = url.match(/^https?:\/\/[^/]+\/[a-z]{2}-[a-z]{2}\/([^/]+)\//i);
  if (!match) return false;
  return EXTRA_ALLOWED_TOP_LEVEL.has(match[1].toLowerCase());
}

function extractProductId(url: string): string {
  const m = url.match(/\/p\/(\d+)/);
  return m ? m[1] : url;
}

async function httpGet(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/xml, text/xml, */*',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

// ── State / misc helpers ───────────────────────────────────────────────────

function loadState(file: string, reset: boolean): SeedState {
  const empty: SeedState = {
    cursor: 0, processed: 0, created: 0, updated: 0, failed: 0,
    failed_urls: [], started_at: new Date().toISOString(), sitemap_fingerprint: null,
  };
  if (reset || !fs.existsSync(file)) return empty;
  try {
    const p = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<SeedState>;
    return {
      cursor: typeof p.cursor === 'number' ? p.cursor : 0,
      processed: typeof p.processed === 'number' ? p.processed : 0,
      created: typeof p.created === 'number' ? p.created : 0,
      updated: typeof p.updated === 'number' ? p.updated : 0,
      failed: typeof p.failed === 'number' ? p.failed : 0,
      failed_urls: Array.isArray(p.failed_urls) ? p.failed_urls : [],
      started_at: typeof p.started_at === 'string' ? p.started_at : empty.started_at,
      sitemap_fingerprint: typeof p.sitemap_fingerprint === 'string' ? p.sitemap_fingerprint : null,
    };
  } catch {
    return empty;
  }
}

function saveState(file: string, state: SeedState): void {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortCat(category: string): string {
  return category.length > 12 ? `${category.slice(0, 11)}…` : category.padEnd(12, ' ');
}

function shortName(name: string): string {
  return name.length > 60 ? `${name.slice(0, 58)}…` : name.padEnd(60, ' ');
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname.slice(-70)}`;
  } catch {
    return url.slice(-70);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
