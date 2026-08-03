// ─────────────────────────────────────────────────────────────────────────────
// OVERLAP-SEEDED DISCOVERY — the ADR-146 experiment.
//
// Blind category traversal costs ~120 fetched products per new comparison, and leaves
// 4 single-retailer rows behind for every comparable one (Noon: 6,736 products → 743
// canonicals, 592 of them Noon-alone). This aims the same crawler instead: every query is
// a product we ALREADY hold from exactly one retailer, so a hit is one retailer short of
// a comparison by construction.
//
// Reuses the production write path (`productService.createOrUpdateProduct`) so identity
// resolution, validation and dedup are unchanged — only the SEED differs.
//
// Usage: tsx seeded-discovery.ts <store_slug> [--go] [--targets=N] [--hits=N]
// ─────────────────────────────────────────────────────────────────────────────
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import pg from 'pg';
import { toPoolerDbUrl } from '../tps-core/pooler-url';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--')) || 'noon';
const GO = args.includes('--go');
const TARGETS = parseInt(args.find((a) => a.startsWith('--targets='))?.split('=')[1] || '250', 10);
const HITS = parseInt(args.find((a) => a.startsWith('--hits='))?.split('=')[1] || '3', 10);

const STORE_ID: Record<string, number> = { noon: 3, extra: 4, almanea: 5, amazon: 2, jarir: 1, swsg: 8, shaker: 7, najm: 9, alnakheelk: 18 };

/** Retailer display names as written into `price_history.store_name`, per store. */
const STORE_NAMES: Record<string, string[]> = {
  noon: ['نون', 'noon', '3'],
  extra: ['اكسترا', 'إكسترا', 'extra', '4'],
  almanea: ['المنيع', 'almanea', '5'],
  amazon: ['أمازون', 'أمازون السعودية', 'amazon', '2'],
  jarir: ['جرير', 'مكتبة جرير', 'jarir', '1'],
  swsg: ['الشتاء والصيف', 'swsg', '8'],
  shaker: ['شاكر', 'shaker', '7'],
  najm: ['نجم الأجهزة', 'najm', '9'],
  alnakheelk: ['متجر النخيل', 'alnakheelk', '18'],
};

(async () => {
  const storeId = STORE_ID[slug];
  if (!storeId) throw new Error(`unknown store ${slug}`);

  const pgc = new pg.Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false } });
  await pgc.connect();

  // TARGETS: canonicals we hold from exactly ONE retailer, that this retailer does NOT
  // already supply, whose BRAND this retailer is known to stock. Each hit is therefore a
  // comparison, not a new single-store row.
  const names = STORE_NAMES[slug];
  const { rows: targets } = await pgc.query<{ id: string; brand: string; model_number: string | null; name_en: string; category: string }>(
    `with mine as (
       select ph.canonical_product_id cid, count(distinct ph.store_name) n,
              bool_or(ph.store_name = any($1)) has_me
       from price_history ph where ph.canonical_product_id is not null group by 1
     ),
     their_brands as (
       select distinct lower(cp.brand) b
       from canonical_products cp join price_history ph on ph.canonical_product_id = cp.id
       where ph.store_name = any($1) and cp.brand is not null
     )
     select cp.id, cp.brand, cp.model_number, cp.name_en, cp.category
     from mine join canonical_products cp on cp.id = mine.cid
     where mine.n = 1 and not mine.has_me and cp.is_active
       and cp.brand is not null and lower(cp.brand) in (select b from their_brands)
       and cp.name_en is not null and length(cp.name_en) > 8
       -- ONLY GATE-ELIGIBLE TARGETS. The relevance gate requires the target's model number
       -- to appear literally in the hit, so a target without one can never be accepted and
       -- querying for it spends a fetch we can never use. Measured 2026-08-03: only 1,263 of
       -- 7,807 active canonicals carry a usable model number, so an ungated sample wasted
       -- ~84% of its fetches and looked like a dead run. Eligible targets: noon 522,
       -- amazon 530, extra 295 — that is the true size of this lever.
       and cp.model_number is not null and length(cp.model_number) >= 5
     order by md5(cp.id::text)
     limit $2`,
    [names, TARGETS],
  );
  console.log(`${slug} seeded discovery — ${GO ? 'LIVE' : 'DRY'} — ${targets.length} targets, top ${HITS} hits each`);
  await pgc.end();

  const { ScrapingOrchestrator } = await import('../../src/lib/scraping/services/scraping-orchestrator');
  const { ProductService } = await import('../../src/lib/scraping/services/product-service');
  const { IngestionService } = await import('../../src/lib/scraping/services/ingestion-service');
  const orch = new ScrapingOrchestrator();
  // SEARCH DISPATCH. A scraper-sourced retailer is seeded through its own keyed search
  // (`scrapeApiPage`); an API-sourced one has no such method — swsg is served by Magento
  // GraphQL, whose `products(search:)` IS the keyed search. Seeding must follow the
  // retailer's actual sourcing mode, which is the same lesson ADR-179/180 produced.
  const { getProvider } = await import('../../src/lib/providers/registry');
  const { magentoSearch } = await import('../../src/lib/providers/sourcing/magento-graphql-adapter');
  const provider = getProvider(slug);
  const magentoOrigin = provider?.sourcing === 'api' ? provider?.magento?.origin : undefined;
  const scraper = magentoOrigin ? null : orch.getScraperForStore(slug);
  if (!scraper && !magentoOrigin) throw new Error('no scraper and no api search for ' + slug);
  // SEARCH DISPATCH, in preference order (ADR-183):
  //   1. Magento GraphQL products(search:) — swsg
  //   2. the KEYED SEARCH LAYER the customer search feature already uses — amazon, extra,
  //      jarir, almanea, shaker, samsung_ksa, noon. Those scrapers are purpose-built for
  //      "find THIS product", which is exactly what a seed asks, and they are already
  //      maintained and exercised in production. Adding a bespoke keyed method to each cron
  //      scraper would have duplicated all of it.
  //   3. the cron scraper's own keyed path, where one exists (noon).
  //
  // ROBOTS CHECKED PER RETAILER BEFORE USE, after the noon lesson:
  //   amazon — /s is ALLOWED (79 disallow rules under *, none match it)
  //   extra  — its search scraper calls search.unbxd.io, Extra's own published storefront
  //            search provider, NOT extra.com/search which their robots.txt disallows
  const { SCRAPERS: SEARCH_SCRAPERS } = await import('../../src/lib/scraping/search/search-orchestrator');
  const searchScraper = SEARCH_SCRAPERS[slug];
  const searchFor = async (seed: string, category: string): Promise<unknown[]> => {
    if (magentoOrigin) return await magentoSearch(magentoOrigin, seed, HITS);
    if (searchScraper) {
      const res = await searchScraper().search({ query: seed, pages: 1 });
      return (res.products ?? []).slice(0, HITS);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (scraper as any).scrapeApiPage(seed, 1, category, HITS);
  };
  const productService = new ProductService();
  // CRITICAL (learned by measurement 2026-07-30): `createOrUpdateProduct` writes ONLY the
  // storefront layer. `price_history` — and therefore every comparison — is produced by
  // normalization reading `raw_observations`, which is written by ingestBatch. The first
  // version of this script omitted ingestBatch, so it wrote 185 storefront offers and ZERO
  // raw observations, and was architecturally incapable of producing the metric it existed
  // to measure. The orchestrator calls both; so must we.
  const ingestion = new IngestionService();

  // Resolve the store id exactly as the production write path does, rather than assuming
  // the numeric id — this is the same lookup runDiscoveryJob performs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svcStoreId: string | null = await (orch as any).getStoreId(slug);
  if (!svcStoreId) throw new Error(`could not resolve store id for ${slug}`);

  /**
   * RELEVANCE GATE — added 2026-08-02 after the swsg dry run reported a 100% hit rate that
   * was entirely fuzzy. Magento's `products(search:)` matches any shared token, so the seed
   * "lenovo Idea Tab 11 128GB 5G" returned a Lenovo MOUSE and an oil heater with 11 FINS,
   * and "dell 27 FHD Monitor" returned a SAMSUNG monitor. Writing those produces
   * single-retailer orphans at best and a FALSE COMPARISON at worst — the precise harm
   * ADR-176 exists to prevent, and the precise bloat ADR-146 exists to avoid.
   *
   * The gate is ADR-176's own standard: the target's MODEL NUMBER must appear LITERALLY in
   * the hit's name or sku. Never inferred, never fuzzy. A target with no model number cannot
   * be verified this way and is skipped rather than guessed at.
   *
   * This will cut the hit rate hard. That smaller number is the correct one.
   */
  const norm = (v: unknown) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const relevant = (target: { model_number: string | null }, hit: Record<string, unknown>): boolean => {
    const model = norm(target.model_number);
    if (model.length < 5) return false;                 // too short to be discriminating
    const hay = norm(hit.name_en) + '|' + norm(hit.name_ar) + '|' + norm(hit.sku);
    return hay.includes(model);
  };

  let queried = 0, fetched = 0, written = 0, created = 0, linked = 0, errors = 0, noHit = 0, rawWritten = 0;
  let rejectedIrrelevant = 0, skippedNoModel = 0;
  // A run id makes every row this experiment writes attributable forever — the permanent
  // fix for the attribution problem that made the first run unreadable.
  const runId: string | null = null;

  for (const t of targets) {
    // Seed = brand + the discriminating part of the name. A model number is the strongest
    // seed when we have one; otherwise the first words of the name carry the model.
    const seed = [t.brand, t.model_number || t.name_en.split(/[,|(]/)[0]].join(' ').replace(/\s+/g, ' ').trim().slice(0, 90);
    queried++;
    try {
      const hits = (await searchFor(seed, t.category)) as any[];
      const candidates = (hits || []).slice(0, HITS);
      // Gate BEFORE counting a hit: an irrelevant match is not a hit, it is noise.
      const top = candidates.filter((h) => relevant(t, h));
      rejectedIrrelevant += candidates.length - top.length;
      fetched += top.length;
      if (top.length === 0) { noHit++; continue; }
      if (!GO) continue;
      // Evidence layer FIRST — same order as the orchestrator. Without this the TPS layer
      // never sees the offer and no comparison can ever result.
      try { await ingestion.ingestBatch(slug, top, storeId, runId); rawWritten += top.length; }
      catch { errors++; }
      for (const p of top) {
        try {
          const r = await productService.createOrUpdateProduct(p, svcStoreId);
          written++;
          if (r.created) created++; else linked++;
        } catch { errors++; }
      }
    } catch { errors++; }
    if (queried % 5 === 0) console.log(`  ${queried}/${targets.length} queried · ${fetched} hits · ${written} written (${linked} linked)`);
    await new Promise((r) => setTimeout(r, 700));
  }

  console.log(JSON.stringify({
    store: slug, mode: GO ? 'LIVE' : 'DRY',
    targets: targets.length, queried, hits_fetched: fetched, targets_with_no_hit: noHit,
    written, created, linked, errors, raw_observations_written: rawWritten,
    rejected_irrelevant: rejectedIrrelevant, skipped_no_model: skippedNoModel,
    hit_rate_pct: queried ? Math.round((queried - noHit) / queried * 1000) / 10 : 0,
  }, null, 2));
  await new Promise((r) => setTimeout(r, 250)); // let stdout flush before exit
  process.exit(0);
})().catch((e) => { console.error('ERR', e instanceof Error ? e.message : e); process.exit(1); });
