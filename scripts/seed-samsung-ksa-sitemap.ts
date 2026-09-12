/**
 * Seed Samsung KSA products by walking samsung.com/sa_en's sitemap.
 *
 * Samsung has a global sitemap with per-country sub-sitemaps; we use the
 * Saudi English one (https://www.samsung.com/sa_en/sitemap.xml), which
 * points to three product sub-sitemaps (im = Information Mobile, da =
 * Digital Appliances, vd = Visual Display) plus an "assorted" one full of
 * landing pages we skip.
 *
 * Product URLs look like /sa_en/<category>/<subcategory>/<sku-slug>/. Any
 * URL with fewer than 3 path segments after the locale is a category or
 * overview page (e.g. /sa_en/audio-sound/compare/) and gets dropped.
 *
 * Mirrors scripts/seed-extra-sitemap.ts in structure: resumable, shared
 * rate limiter per scraper instance, prints per-product progress lines.
 *
 * Usage:
 *   npx tsx scripts/seed-samsung-ksa-sitemap.ts
 *
 *   SEED_LIMIT=100 npx tsx scripts/seed-samsung-ksa-sitemap.ts  # dry-run
 *   SEED_RESET_STATE=true npx tsx scripts/seed-samsung-ksa-sitemap.ts
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
  cursor: number;
  processed: number;
  created: number;
  updated: number;
  /** Pages fetched OK but had no purchasable price — archive/discontinued SKUs. */
  archived: number;
  /** Real scrape errors (network, parse, DB write). These trigger cooldown. */
  failed: number;
  failed_urls: string[];
  started_at: string;
  sitemap_fingerprint: string | null;
};

// Sub-sitemaps that hold actual product URLs. `assorted-sitemap.xml` is overwhelmingly
// marketing/landing pages — skip (re-audited 2026-09-12, Samsung KSA official-catalog
// closure mission: 481 URLs, exactly one genuine current standalone product found in it,
// a projector-class "movable screen" with no matching category plugin — documented, not
// worth a 4th sitemap fetch + new category support for one SKU).
const SUB_SITEMAPS = [
  'https://www.samsung.com/sa_en/im-sitemap.xml',  // ~839: phones, tablets, watches, rings, buds, mobile accessories
  'https://www.samsung.com/sa_en/da-sitemap.xml',  // ~265: ACs, fridges, washers, vacuum cleaners, air care
  'https://www.samsung.com/sa_en/vd-sitemap.xml',  // ~396: TVs, monitors, audio
];

async function main(): Promise<void> {
  const LIMIT = parseInt(process.env.SEED_LIMIT || '999999', 10);
  const RESET_STATE = (process.env.SEED_RESET_STATE || 'false').toLowerCase() === 'true';
  const STATE_FILE = process.env.SEED_STATE_FILE
    || path.join(__dirname, '..', '.scrape-state', 'samsung-ksa-seed.json');
  const URL_CACHE_FILE = process.env.SEED_URL_CACHE
    || path.join(__dirname, '..', '.scrape-state', 'samsung-ksa-urls.json');
  const COOLDOWN_MS = parseInt(process.env.SEED_COOLDOWN_MS || '120000', 10);
  const MAX_CONSECUTIVE_NULLS = parseInt(process.env.SEED_MAX_CONSECUTIVE_NULLS || '5', 10);

  const { SamsungKsaScraper, isSamsungKsaProductUrl, HIGH_VALUE_ACCESSORY_SLUG } = await import('../src/lib/scraping/stores/samsung-ksa-scraper');
  const { ProductService } = await import('../src/lib/scraping/services/product-service');
  const { createServerClient } = await import('../src/lib/database');

  const supabase = createServerClient();

  const { data: storeRow, error: storeErr } = await supabase
    .from('stores')
    .select('id')
    .eq('slug', 'samsung_ksa')
    .single();
  if (storeErr || !storeRow) {
    console.error(`Could not resolve samsung_ksa store: ${storeErr?.message || 'not found'}`);
    process.exit(1);
  }
  const storeId = (storeRow as { id: string }).id;

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
      console.log(`[${stamp()}] loaded cached URL list: ${urls.length} urls`);
    } catch {
      urls = [];
    }
  }

  if (urls.length === 0) {
    console.log(`[${stamp()}] fetching sitemaps...`);
    const built = await fetchAllProductUrls(SUB_SITEMAPS, isSamsungKsaProductUrl, HIGH_VALUE_ACCESSORY_SLUG);
    urls = built.urls;
    sitemapFingerprint = built.fingerprint;
    fs.mkdirSync(path.dirname(URL_CACHE_FILE), { recursive: true });
    fs.writeFileSync(URL_CACHE_FILE, JSON.stringify({ urls, fingerprint: sitemapFingerprint }, null, 2));
    console.log(`[${stamp()}] cached ${urls.length} product URLs → ${URL_CACHE_FILE}`);
  }

  const state: SeedState = loadState(STATE_FILE, RESET_STATE);
  if (state.sitemap_fingerprint && state.sitemap_fingerprint !== sitemapFingerprint) {
    console.warn(`[${stamp()}] WARN: cached state was written against a different sitemap. Set SEED_RESET_STATE=true to start over.`);
  }
  state.sitemap_fingerprint = sitemapFingerprint;

  const scraper = new SamsungKsaScraper();
  const productService = new ProductService();

  let processedNow = 0;
  let consecutiveNulls = 0;
  let cooldownsHit = 0;
  const scriptStart = Date.now();

  console.log(
    `[${stamp()}] seed-samsung-ksa-sitemap starting —`
    + ` total_urls=${urls.length} cursor=${state.cursor} limit=${LIMIT}`
  );

  try {
    for (; state.cursor < urls.length && processedNow < LIMIT; state.cursor++) {
      const url = urls[state.cursor];
      if (!url) continue;
      const rowStart = Date.now();
      try {
        const scraped = await scraper.updateProductPrice(url);
        if (!scraped) {
          // Page was fetched OK but had no purchasable price (archive SKU).
          // This is expected for legacy Samsung AC models and a few VD
          // products. Log it as "archive" and deliberately do NOT bump
          // consecutiveNulls — these clusters shouldn't trigger the
          // rate-limit safety cooldown.
          state.archived++;
          console.log(`[${stamp()}] ∅ [${state.cursor}] archive (no price) (${Math.round((Date.now() - rowStart) / 1000)}s) — ${shortUrl(url)}`);
        } else {
          const { created } = await productService.createOrUpdateProduct(scraped, storeId);
          if (created) state.created++;
          else state.updated++;
          consecutiveNulls = 0;
          console.log(
            `[${stamp()}] ${created ? '+' : '✓'} [${state.cursor}] ${shortCat(scraped.category)}`
            + ` ${shortName(scraped.name_en)}`
            + ` sar=${scraped.current_price}`
            + ` rating=${scraped.merchant_rating ?? 'n/a'}`
            + ` (${Math.round((Date.now() - rowStart) / 1000)}s)`
          );
        }
      } catch (err) {
        // Real failure — fetch error, parse error, or DB write error.
        // These DO bump consecutiveNulls so a genuine rate-limit event
        // still triggers the safety cooldown.
        state.failed++;
        state.failed_urls.push(url);
        consecutiveNulls++;
        console.log(`[${stamp()}] ✗ [${state.cursor}] ${err instanceof Error ? err.message : String(err)} — ${shortUrl(url)}`);
        if (consecutiveNulls >= MAX_CONSECUTIVE_NULLS) {
          cooldownsHit++;
          console.log(`[${stamp()}] ${consecutiveNulls} consecutive errors → sleeping ${Math.round(COOLDOWN_MS / 1000)}s`);
          await sleep(COOLDOWN_MS);
          consecutiveNulls = 0;
        }
      }

      state.processed++;
      processedNow++;

      if (processedNow % 25 === 0) saveState(STATE_FILE, state);
    }
  } finally {
    saveState(STATE_FILE, state);
    await scraper.cleanup().catch(() => {});
  }

  const elapsed = Date.now() - scriptStart;
  console.log(`\n${'─'.repeat(70)}\nSEED SUMMARY\n${'─'.repeat(70)}`);
  console.log(
    `  processed_now=${processedNow}  created=${state.created}  updated=${state.updated}`
    + `  archived=${state.archived}  failed=${state.failed}`
    + `  cooldowns=${cooldownsHit}  elapsed=${Math.round(elapsed / 60000)}m`
  );
  console.log(`  cursor=${state.cursor} / ${urls.length}  remaining=${Math.max(0, urls.length - state.cursor)}`);
}

// ── Sitemap ────────────────────────────────────────────────────────────────

async function fetchAllProductUrls(
  submapUrls: string[],
  isSamsungKsaProductUrl: (url: string) => boolean,
  HIGH_VALUE_ACCESSORY_SLUG: RegExp,
): Promise<{ urls: string[]; fingerprint: string }> {
  const urlSet = new Set<string>();
  let totalSeen = 0;
  let skippedByPattern = 0;

  for (const smUrl of submapUrls) {
    try {
      const xml = await httpGet(smUrl);
      const locs = (xml.match(/<loc>([^<]+)<\/loc>/g) || []).map((m) => m.replace(/<\/?loc>/g, ''));
      console.log(`  ${smUrl.split('/').pop()}: ${locs.length} URLs`);
      for (const loc of locs) {
        // Strip stray trailing quotes / attr-ish garbage we saw in vd-sitemap.
        const cleaned = loc.replace(/["\\\s]+$/, '').trim();
        totalSeen++;
        // mobile-accessories URLs pass the shape check (accessory paths get a 3-segment
        // floor) but are scoped to only the founder-named high-value items — same policy
        // as samsung-ksa-scraper.ts's own discovery path, not a full accessory ingestion.
        const isLowValueAccessory = /\/mobile-accessories\//i.test(cleaned) && !HIGH_VALUE_ACCESSORY_SLUG.test(cleaned);
        if (isSamsungKsaProductUrl(cleaned) && !isLowValueAccessory) {
          urlSet.add(cleaned);
        } else {
          skippedByPattern++;
        }
      }
    } catch (err) {
      console.warn(`  WARN: failed to fetch ${smUrl}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`  kept ${urlSet.size} product URLs (skipped ${skippedByPattern} non-product / non-KSA out of ${totalSeen} total)`);

  const urls = Array.from(urlSet).sort();
  const fingerprint = `count=${urls.length};first=${urls[0] || ''};last=${urls[urls.length - 1] || ''}`;
  return { urls, fingerprint };
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
    cursor: 0, processed: 0, created: 0, updated: 0, archived: 0, failed: 0,
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
      archived: typeof p.archived === 'number' ? p.archived : 0,
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
  return name.length > 50 ? `${name.slice(0, 48)}…` : name.padEnd(50, ' ');
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.slice(-70);
  } catch {
    return url.slice(-70);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
