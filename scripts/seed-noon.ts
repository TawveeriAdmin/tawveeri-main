/**
 * Seed Noon products by walking Noon's internal catalog API across a
 * brand-matrix of keyword queries.
 *
 * Background: Noon doesn't publish a useful sitemap and its
 * `/_svc/catalog/api/v3/u/en-sa/search` endpoint is relevance-ranked, so
 * a single broad query like "smartphone" plateaus after ~2k hits — the
 * same top SKUs repeat across pages. To reach the long tail we fan out
 * per category into a list of brand-specific queries ("iphone",
 * "galaxy s", "xiaomi", …); each query returns a different slice of the
 * index. Combined, the matrix covers ~10-20× more unique products than
 * the single-keyword approach.
 *
 * The title-based `classifyFromTitle` filter in `NoonScraper.parseApiProduct`
 * drops any non-electronics that slip through the search ranker
 * (perfumes, mugs, food, fashion), so broader queries are safe to issue.
 *
 * Usage:
 *   # full matrix — 16 categories × ~20 queries × up to 100 pages/query
 *   npx tsx scripts/seed-noon.ts
 *
 *   # cap pages per query (useful for smoke tests)
 *   SEED_MAX_PAGES=3 npx tsx scripts/seed-noon.ts
 *
 *   # restrict to specific categories (comma-separated enum values)
 *   SEED_CATEGORIES=smartphone,laptop,tv npx tsx scripts/seed-noon.ts
 *
 *   # parallel shards — run 3-4 terminals with disjoint SEED_CATEGORIES
 *   # and distinct SEED_STATE_FILE paths so they don't clobber each other.
 *   SEED_CATEGORIES=smartphone,tablet,wearable \
 *     SEED_STATE_FILE=.scrape-state/noon-seed-mobile.json \
 *     npx tsx scripts/seed-noon.ts
 *
 *   # start over (discards resume state; REQUIRED on first run with the
 *   # new brand-matrix state shape)
 *   SEED_RESET_STATE=true npx tsx scripts/seed-noon.ts
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

// Brand-matrix per category. Each inner array is a list of keyword queries
// that hit a different slice of Noon's search index. Brand names combined
// with a category hint (e.g., "samsung galaxy watch" vs just "samsung")
// narrow results to the right product type and avoid crowding with
// off-category hits. Keep queries broad enough that Noon's ranker returns
// hundreds of results per query but specific enough that `classifyFromTitle`
// accepts most of them.
//
// Skipped categories:
//   - `accessories` — the electronics filter rejects cables/cases/chargers
//     since they'd otherwise mis-classify (e.g., "iPhone 14 case" as
//     smartphone). Other stores cover accessories properly.
//   - `refrigerator` — subset of `appliance`; `appliance` queries already
//     cover refrigerators through brand names.
const CATEGORY_QUERIES: Record<string, string[]> = {
  smartphone: [
    'iphone', 'samsung galaxy s', 'samsung galaxy a', 'samsung galaxy z',
    'xiaomi', 'redmi', 'poco phone', 'huawei smartphone', 'honor phone',
    'oppo', 'vivo smartphone', 'realme', 'oneplus', 'google pixel',
    'nothing phone', 'nokia smartphone', 'motorola', 'infinix', 'tecno',
    'itel mobile', 'asus rog phone', 'cat phone',
  ],
  laptop: [
    'macbook', 'dell laptop', 'hp laptop', 'lenovo thinkpad', 'lenovo ideapad',
    'lenovo legion', 'asus laptop', 'asus rog laptop', 'asus zenbook',
    'acer laptop', 'acer predator', 'msi laptop', 'microsoft surface laptop',
    'razer blade', 'huawei matebook', 'lg gram', 'samsung galaxy book',
    'gigabyte laptop', 'chromebook', 'alienware',
  ],
  tablet: [
    'ipad', 'ipad pro', 'ipad air', 'ipad mini', 'samsung galaxy tab',
    'galaxy tab s', 'huawei matepad', 'xiaomi pad', 'lenovo tab',
    'honor pad', 'amazon fire tablet', 'microsoft surface tablet',
    'oppo pad', 'realme pad', 'nokia tablet',
  ],
  tv: [
    'samsung tv', 'samsung qled', 'samsung neo qled', 'lg tv', 'lg oled',
    'sony bravia', 'hisense tv', 'tcl tv', 'xiaomi tv', 'toshiba tv',
    'philips tv', 'panasonic tv', 'nikai tv', 'skyworth tv', 'jvc tv',
    '4k smart tv', '8k smart tv', 'frame tv',
  ],
  audio: [
    'sony headphones', 'bose headphones', 'jbl speaker', 'airpods',
    'samsung galaxy buds', 'beats headphones', 'sennheiser', 'marshall speaker',
    'anker soundcore', 'harman kardon', 'skullcandy', 'audio-technica',
    'kef', 'logitech speaker', 'sonos', 'bang olufsen', 'razer headset',
    'hyperx headset', 'astro gaming headset', 'edifier', 'bluetooth speaker',
    'noise cancelling headphones', 'soundbar',
  ],
  gaming: [
    'playstation 5', 'ps5 console', 'ps5 games', 'xbox series x',
    'xbox series s', 'xbox games', 'nintendo switch', 'switch games',
    'steam deck', 'asus rog ally', 'gaming controller', 'dualsense',
    'elite controller', 'gaming chair', 'vr headset', 'meta quest',
  ],
  camera: [
    'canon camera', 'canon eos', 'nikon camera', 'sony alpha', 'sony camera',
    'fujifilm camera', 'panasonic lumix', 'olympus camera', 'gopro',
    'dji camera', 'dji pocket', 'insta360', 'leica camera', 'kodak camera',
    'dslr', 'mirrorless camera', 'action camera', 'polaroid camera',
    'camera lens',
  ],
  monitor: [
    'lg monitor', 'samsung monitor', 'dell monitor', 'hp monitor',
    'asus monitor', 'benq monitor', 'msi monitor', 'aoc monitor',
    'lg ultragear', 'samsung odyssey', 'gaming monitor', 'ultrawide monitor',
    'curved monitor', '4k monitor', 'portable monitor', 'studio display',
  ],
  wearable: [
    'apple watch', 'samsung galaxy watch', 'garmin watch', 'fitbit',
    'xiaomi mi band', 'xiaomi watch', 'huawei watch', 'amazfit',
    'honor band', 'honor watch', 'realme watch', 'oppo watch', 'casio g-shock',
    'suunto watch', 'polar watch', 'smart ring',
  ],
  networking: [
    'tp-link router', 'tp-link mesh', 'netgear router', 'netgear orbi',
    'asus router', 'linksys router', 'huawei router', 'xiaomi router',
    'd-link router', 'ubiquiti', 'tenda router', 'mikrotik',
    'wifi 6 router', 'mesh wifi', 'wifi extender', 'network switch',
    'stc wifi router', 'powerline adapter',
  ],
  smart_home: [
    'philips hue', 'amazon echo', 'alexa', 'google nest', 'nest hub',
    'ring doorbell', 'ring camera', 'tp-link tapo', 'xiaomi mi smart',
    'aqara', 'yeelight', 'smart bulb', 'smart plug', 'smart lock',
    'smart doorbell', 'smart thermostat', 'robot vacuum', 'roborock',
    'ecovacs', 'irobot roomba', 'smart camera',
  ],
  printer: [
    'hp printer', 'hp deskjet', 'hp laserjet', 'canon printer',
    'canon pixma', 'epson printer', 'epson ecotank', 'brother printer',
    'xerox printer', 'samsung printer', 'lexmark printer',
    'all-in-one printer', 'laser printer', 'inkjet printer',
    'photo printer', 'label printer', 'portable printer',
  ],
  appliance: [
    'lg refrigerator', 'samsung refrigerator', 'bosch refrigerator',
    'hisense refrigerator', 'toshiba refrigerator', 'sharp refrigerator',
    'whirlpool refrigerator', 'hitachi refrigerator', 'samsung washing machine',
    'lg washing machine', 'bosch washing machine', 'haier washing machine',
    'hisense washing machine', 'samsung dryer', 'lg dryer',
    'dishwasher', 'microwave oven', 'samsung microwave', 'lg microwave',
    'panasonic microwave', 'air conditioner', 'split ac', 'gree ac',
    'midea ac', 'daikin ac', 'water heater', 'water dispenser',
    'vacuum cleaner', 'dyson vacuum', 'samsung vacuum',
  ],
  kitchen: [
    'nespresso', 'delonghi coffee', 'philips coffee', 'breville',
    'ninja blender', 'ninja air fryer', 'philips air fryer',
    'kenwood mixer', 'kenwood blender', 'moulinex', 'tefal',
    'braun blender', 'bosch kitchen', 'black decker kitchen',
    'smeg', 'kitchenaid', 'instant pot', 'pressure cooker',
    'rice cooker', 'slow cooker', 'food processor', 'stand mixer',
    'toaster', 'kettle', 'juicer', 'coffee grinder', 'espresso machine',
    'drip coffee maker',
  ],
  personal_care: [
    'philips shaver', 'braun shaver', 'braun epilator', 'remington',
    'panasonic shaver', 'panasonic grooming', 'oral-b', 'oral b electric toothbrush',
    'philips sonicare', 'dyson hair dryer', 'dyson airwrap', 'ghd',
    'babyliss', 'hair straightener', 'hair curler', 'beard trimmer',
    'body trimmer', 'nose trimmer', 'women shaver', 'IPL hair removal',
    'facial cleanser device',
  ],
  refrigerator: [
    'refrigerator', 'fridge', 'samsung fridge', 'lg fridge', 'bosch fridge',
    'hisense fridge', 'toshiba fridge', 'sharp fridge', 'mini fridge',
    'side by side refrigerator', 'french door refrigerator',
    'top mount refrigerator', 'bottom mount refrigerator', 'freezer',
  ],
};

const ALL_CATEGORIES = Object.keys(CATEGORY_QUERIES);

type SeedState = {
  /** Which category we're on. Index into the user-filtered category list. */
  category_cursor: number;
  /** Which query within the current category. */
  query_cursor: number;
  /** Next page to fetch for the current (category, query). 1-based. */
  page_cursor: number;
  /** Running totals across all resume sessions. */
  processed: number;
  created: number;
  updated: number;
  failed: number;
  started_at: string;
};

async function main(): Promise<void> {
  const MAX_PAGES = parseInt(process.env.SEED_MAX_PAGES || '100', 10);
  const RESET_STATE = (process.env.SEED_RESET_STATE || 'false').toLowerCase() === 'true';
  const STATE_FILE = process.env.SEED_STATE_FILE
    || path.join(__dirname, '..', '.scrape-state', 'noon-seed.json');
  const CATEGORIES_FILTER = (process.env.SEED_CATEGORIES || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const MAX_CONSECUTIVE_EMPTY_PAGES = parseInt(process.env.SEED_MAX_CONSECUTIVE_EMPTY || '3', 10);

  const { NoonScraper } = await import('../src/lib/scraping/stores/noon-scraper');
  const { ProductService } = await import('../src/lib/scraping/services/product-service');
  const { createServerClient } = await import('../src/lib/database');

  const supabase = createServerClient();

  const { data: storeRow, error: storeErr } = await supabase
    .from('stores')
    .select('id')
    .eq('slug', 'noon')
    .single();
  if (storeErr || !storeRow) {
    console.error(`Could not resolve noon store: ${storeErr?.message || 'not found'}`);
    process.exit(1);
  }
  const storeId = (storeRow as { id: string }).id;

  const categories = CATEGORIES_FILTER.length > 0
    ? ALL_CATEGORIES.filter((c) => CATEGORIES_FILTER.includes(c))
    : [...ALL_CATEGORIES];
  if (categories.length === 0) {
    console.error(`SEED_CATEGORIES matched no known category. Known: ${ALL_CATEGORIES.join(', ')}`);
    process.exit(1);
  }

  const state: SeedState = loadState(STATE_FILE, RESET_STATE);
  const scriptStart = Date.now();
  const stamp = () => new Date().toISOString().slice(11, 19);

  const totalQueries = categories.reduce((sum, c) => sum + CATEGORY_QUERIES[c].length, 0);
  console.log(
    `[${stamp()}] seed-noon starting —`
    + ` categories=${categories.length} total_queries=${totalQueries} max_pages_per_query=${MAX_PAGES}`
    + ` cursor=cat ${state.category_cursor}/${categories.length}`
    + ` query ${state.query_cursor} page ${state.page_cursor}`
  );

  const scraper = new NoonScraper();
  const scrapeApiPage = (scraper as unknown as {
    scrapeApiPage: (query: string, page: number, category: string) => Promise<Array<{
      name_en: string; name_ar: string; brand: string; current_price: number;
      product_url: string; image_urls: string[]; sku: string | null;
      category: string;
    }>>;
  }).scrapeApiPage.bind(scraper);

  const productService = new ProductService();

  try {
    for (; state.category_cursor < categories.length; state.category_cursor++) {
      const category = categories[state.category_cursor];
      const queries = CATEGORY_QUERIES[category];

      console.log(`\n[${stamp()}] ═══ ${category} — ${queries.length} queries ═══`);

      for (; state.query_cursor < queries.length; state.query_cursor++) {
        const query = queries[state.query_cursor];
        console.log(`\n[${stamp()}] ── query ${state.query_cursor + 1}/${queries.length}: "${query}" (from page ${state.page_cursor}) ──`);

        let consecutiveEmpty = 0;

        for (; state.page_cursor <= MAX_PAGES; state.page_cursor++) {
          const pageStart = Date.now();
          let pageProducts: Awaited<ReturnType<typeof scrapeApiPage>> = [];

          try {
            pageProducts = await scrapeApiPage(query, state.page_cursor, category);
          } catch (err) {
            console.log(`[${stamp()}] ✗ page ${state.page_cursor}: ${err instanceof Error ? err.message : String(err)}`);
            consecutiveEmpty++;
            if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY_PAGES) {
              console.log(`[${stamp()}] ${consecutiveEmpty} consecutive empty/error pages → query exhausted`);
              break;
            }
            continue;
          }

          if (pageProducts.length === 0) {
            consecutiveEmpty++;
            console.log(`[${stamp()}] ∅ page ${state.page_cursor}: 0 products (after electronics filter)`);
            if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY_PAGES) {
              console.log(`[${stamp()}] ${consecutiveEmpty} consecutive empty pages → query exhausted`);
              break;
            }
            continue;
          }

          consecutiveEmpty = 0;

          let pageCreated = 0;
          let pageUpdated = 0;
          let pageFailed = 0;
          for (const scraped of pageProducts) {
            try {
              const { created } = await productService.createOrUpdateProduct(
                scraped as Parameters<typeof productService.createOrUpdateProduct>[0],
                storeId,
              );
              if (created) pageCreated++;
              else pageUpdated++;
              state.processed++;
            } catch (err) {
              pageFailed++;
              state.failed++;
              console.log(`[${stamp()}]   ✗ ${(scraped.name_en || '').slice(0, 50)}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
          state.created += pageCreated;
          state.updated += pageUpdated;

          console.log(
            `[${stamp()}] · page ${state.page_cursor}: +${pageCreated} new, ↻${pageUpdated} updated`
            + (pageFailed > 0 ? `, ✗${pageFailed} failed` : '')
            + ` (${Math.round((Date.now() - pageStart) / 1000)}s)`
          );

          if (state.processed % 100 < pageProducts.length) {
            saveState(STATE_FILE, state);
          }
        }

        // Done with this query — reset page cursor for the next one.
        state.page_cursor = 1;
        saveState(STATE_FILE, state);
      }

      // Done with this category — reset query cursor for the next one.
      state.query_cursor = 0;
      state.page_cursor = 1;
      saveState(STATE_FILE, state);
    }
  } finally {
    saveState(STATE_FILE, state);
    await scraper.cleanup().catch(() => {});
  }

  const elapsed = Date.now() - scriptStart;
  console.log(`\n${'─'.repeat(70)}\nSEED SUMMARY\n${'─'.repeat(70)}`);
  console.log(
    `  processed=${state.processed}  created=${state.created}  updated=${state.updated}`
    + `  failed=${state.failed}`
    + `  elapsed=${Math.round(elapsed / 60000)}m`
  );
  console.log(`  state → ${STATE_FILE}`);
}

function loadState(file: string, reset: boolean): SeedState {
  const empty: SeedState = {
    category_cursor: 0, query_cursor: 0, page_cursor: 1,
    processed: 0, created: 0, updated: 0, failed: 0,
    started_at: new Date().toISOString(),
  };
  if (reset || !fs.existsSync(file)) return empty;
  try {
    const p = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<SeedState>;
    return {
      category_cursor: typeof p.category_cursor === 'number' ? p.category_cursor : 0,
      query_cursor: typeof p.query_cursor === 'number' ? p.query_cursor : 0,
      page_cursor: typeof p.page_cursor === 'number' ? p.page_cursor : 1,
      processed: typeof p.processed === 'number' ? p.processed : 0,
      created: typeof p.created === 'number' ? p.created : 0,
      updated: typeof p.updated === 'number' ? p.updated : 0,
      failed: typeof p.failed === 'number' ? p.failed : 0,
      started_at: typeof p.started_at === 'string' ? p.started_at : empty.started_at,
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

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
