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

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--')) || 'noon';
const GO = args.includes('--go');
const TARGETS = parseInt(args.find((a) => a.startsWith('--targets='))?.split('=')[1] || '250', 10);
const HITS = parseInt(args.find((a) => a.startsWith('--hits='))?.split('=')[1] || '3', 10);

const STORE_ID: Record<string, number> = { noon: 3, extra: 4, almanea: 5, amazon: 2, jarir: 1 };

/** Retailer display names as written into `price_history.store_name`, per store. */
const STORE_NAMES: Record<string, string[]> = {
  noon: ['نون', 'noon', '3'],
  extra: ['اكسترا', 'إكسترا', 'extra', '4'],
  almanea: ['المنيع', 'almanea', '5'],
  amazon: ['أمازون', 'أمازون السعودية', 'amazon', '2'],
  jarir: ['جرير', 'مكتبة جرير', 'jarir', '1'],
};

(async () => {
  const storeId = STORE_ID[slug];
  if (!storeId) throw new Error(`unknown store ${slug}`);

  const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
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
  const scraper = orch.getScraperForStore(slug);
  if (!scraper) throw new Error('no scraper');
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

  let queried = 0, fetched = 0, written = 0, created = 0, linked = 0, errors = 0, noHit = 0, rawWritten = 0;
  // A run id makes every row this experiment writes attributable forever — the permanent
  // fix for the attribution problem that made the first run unreadable.
  const runId: string | null = null;

  for (const t of targets) {
    // Seed = brand + the discriminating part of the name. A model number is the strongest
    // seed when we have one; otherwise the first words of the name carry the model.
    const seed = [t.brand, t.model_number || t.name_en.split(/[,|(]/)[0]].join(' ').replace(/\s+/g, ' ').trim().slice(0, 90);
    queried++;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hits: any[] = await (scraper as any).scrapeApiPage(seed, 1, t.category);
      const top = (hits || []).slice(0, HITS);
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
    if (queried % 25 === 0) console.log(`  ${queried}/${targets.length} queried · ${fetched} hits · ${written} written (${linked} linked)`);
    await new Promise((r) => setTimeout(r, 700));
  }

  console.log(JSON.stringify({
    store: slug, mode: GO ? 'LIVE' : 'DRY',
    targets: targets.length, queried, hits_fetched: fetched, targets_with_no_hit: noHit,
    written, created, linked, errors, raw_observations_written: rawWritten,
    hit_rate_pct: queried ? Math.round((queried - noHit) / queried * 1000) / 10 : 0,
  }, null, 2));
  process.exit(0);
})().catch((e) => { console.error('ERR', e instanceof Error ? e.message : e); process.exit(1); });
