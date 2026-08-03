// ─────────────────────────────────────────────────────────────────────────────
// TARGETED RE-OBSERVATION OF COMPARABLE PRODUCTS (U2b · ADR-195).
//
// The product is comparison, and a comparison's cheapest offer is its claim surface —
// yet nothing re-observes a SPECIFIC offer. The orchestrator's price loop covers only
// INGEST_STORES and selects by storefront staleness (product_stores.last_checked_at),
// so a comparable's cheapest offer can go unobserved for weeks while catalog crawls
// flow thousands of rows around it. Measured 2026-08-03 (observation basis, npo):
// 161 cheapest-offer pairs unobserved >168h — extra 79 · amazon 59 · jarir 9.
//
// This script selects exactly those pairs and re-observes them through the SAME
// production write path the price loop uses: scraper.updateProductPrice(raw_url) →
// IngestionService.ingestBatch → raw_observations → hourly normalize (ADR-099: the
// scheduler owns realization; this script only appends raw evidence).
//
// Usage:
//   npx tsx scripts/tps-core/reobserve-comparables.ts               # DRY: list targets
//   npx tsx scripts/tps-core/reobserve-comparables.ts --go          # fetch + ingest
//   --limit=60 (total) --per-store=25 (throttle guard) --stale-hours=168 --stores=a,b
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import pg from "pg";
import { toPoolerDbUrl } from "./pooler-url";
import { TPS_STORES } from "./category-registry";

const args = process.argv.slice(2);
const GO = args.includes("--go");
const num = (name: string, d: number) => parseInt(args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] || String(d), 10);
const LIMIT = num("limit", 50);
const PER_STORE = num("per-store", 25);
const STALE_HOURS = num("stale-hours", 168);
const ONLY_STORES = args.find((a) => a.startsWith("--stores="))?.split("=")[1]?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;

// Same identity maps as seeded-discovery.ts — store_name namespaces as written into
// price_history / normalized_product_observations, and the numeric TPS store ids.
const STORE_ID: Record<string, number> = { noon: 3, extra: 4, almanea: 5, amazon: 2, jarir: 1, swsg: 8, shaker: 7, najm: 9, alnakheelk: 18 };
const STORE_NAMES: Record<string, string[]> = {
  noon: ["نون", "noon", "3"],
  extra: ["اكسترا", "إكسترا", "extra", "4"],
  almanea: ["المنيع", "almanea", "5"],
  amazon: ["أمازون", "أمازون السعودية", "amazon", "amazon.sa", "2"],
  jarir: ["جرير", "مكتبة جرير", "jarir", "1"],
  swsg: ["الشتاء والصيف", "شيتا وسيف", "swsg", "8"],
  shaker: ["شاكر", "ibrahim-shaker", "shaker", "7"],
  najm: ["نجم الأجهزة", "نجم", "najm", "9"],
  alnakheelk: ["متجر النخيل", "النخيل", "alnakheelk", "18"],
};
const NAME_TO_SLUG = new Map<string, string>();
for (const [slug, names] of Object.entries(STORE_NAMES)) for (const n of names) NAME_TO_SLUG.set(n.toLowerCase(), slug);

type Target = { cid: string; slug: string; raw_url: string | null; raw_name: string; last_observed: string | null };

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn") || url.includes("ffpsjjazsluolysgithg")) {
    console.error("refusing: not production"); process.exit(1);
  }
  const pgc = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await pgc.connect();

  // The store map, flattened for SQL.
  const mapRows = Object.entries(STORE_NAMES).flatMap(([slug, names]) => names.map((n) => ({ k: n.toLowerCase(), slug })));
  const mapValues = mapRows.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(",");
  const mapParams = mapRows.flatMap((r) => [r.k, r.slug]);

  // Cheapest-offer-first: for every displayable comparable (>=2 approved retailers on
  // active canonicals), take the CHEAPEST current offer; keep pairs whose TRUE last
  // observation (normalized_product_observations, a row per observation — ADR-194) is
  // older than STALE_HOURS; recover the offer's raw_url from its newest raw observation.
  const { rows: targets } = await pgc.query<Target>(
    `with m(k, slug) as (values ${mapValues}),
     latest as (
       select distinct on (ph.canonical_product_id, m.slug)
              ph.canonical_product_id cid, m.slug, ph.price
       from price_history ph
       join canonical_products cp on cp.id = ph.canonical_product_id and cp.is_active
       join m on m.k = lower(trim(ph.store_name))
       order by ph.canonical_product_id, m.slug, ph.observed_at desc
     ),
     n as (select cid, count(*) s from latest group by 1),
     cheapest as (
       select distinct on (l.cid) l.cid, l.slug
       from latest l join n on n.cid = l.cid and n.s >= 2
       order by l.cid, l.price asc
     ),
     tru as (
       select c.cid, c.slug,
              (select max(npo.observed_at) from normalized_product_observations npo
                 join m m2 on m2.k = lower(trim(npo.store_id::text))
               where npo.canonical_product_id = c.cid and m2.slug = c.slug) last_observed
       from cheapest c
     ),
     stale as (
       select * from tru
       where last_observed is null or last_observed < now() - ($${mapParams.length + 1}::int * interval '1 hour')
     )
     select s.cid, s.slug, s.last_observed::text,
            ro.raw_url, coalesce(ro.raw_name, '') raw_name
     from stale s
     -- The offer's URL comes from the pair's newest normalized observation payload:
     -- the normalizer stamps normalized_payload._url (raw_payload is NULL on current rows,
     -- and source_record_id is a stableUuid — it cannot join raw_observations).
     left join lateral (
       select npo.normalized_payload->>'_url' as raw_url, npo.raw_name
       from normalized_product_observations npo
       join m m3 on m3.k = lower(trim(npo.store_id::text)) and m3.slug = s.slug
       where npo.canonical_product_id = s.cid
         and coalesce(npo.normalized_payload->>'_url', '') <> ''
       order by npo.observed_at desc
       limit 1
     ) ro on true
     order by s.last_observed asc nulls first`,
    [...mapParams, STALE_HOURS],
  );
  if (!GO) await pgc.end(); // LIVE keeps the connection for delist-signal writes/heals

  // Bound the run: per-store cap first (throttle safety — amazon especially), then total.
  const perStore = new Map<string, number>();
  const picked: Target[] = [];
  for (const t of targets) {
    if (ONLY_STORES && !ONLY_STORES.includes(t.slug)) continue;
    if (!t.raw_url) continue; // counted below; a pair with no recoverable URL cannot be re-fetched
    const c = perStore.get(t.slug) ?? 0;
    if (c >= PER_STORE) continue;
    perStore.set(t.slug, c + 1);
    picked.push(t);
    if (picked.length >= LIMIT) break;
  }
  const noUrl = targets.filter((t) => !t.raw_url).length;

  console.log(`reobserve-comparables — ${GO ? "LIVE" : "DRY"} — stale pairs ${targets.length} (no-url ${noUrl}) → picked ${picked.length} (limit ${LIMIT}, per-store ${PER_STORE}, stale>=${STALE_HOURS}h)`);
  for (const [slug, c] of perStore) console.log(`  ${slug.padEnd(12)} ${c}`);
  if (!GO) {
    for (const t of picked.slice(0, 15)) console.log(`  ${t.slug.padEnd(10)} last=${t.last_observed ?? "never"} ${String(t.raw_url).slice(0, 90)}`);
    process.exit(0);
  }

  const { ScrapingOrchestrator } = await import("../../src/lib/scraping/services/scraping-orchestrator");
  const { IngestionService } = await import("../../src/lib/scraping/services/ingestion-service");
  const orch = new ScrapingOrchestrator();
  const ingestion = new IngestionService();

  // ADR-196 phase 1 — a NULL is not one thing. First run measured 8 nulls; the extra ones
  // were HTTP 404s: DELISTED pages whose stale prices still win best-price. Classify every
  // null with a direct status probe so "gone" becomes recorded evidence, not silence
  // (Appendix B: every attempt ends in an explicit state).
  const classifyNull = async (u: string): Promise<"gone" | "parse_fail" | "blocked" | "network"> => {
    try {
      const res = await fetch(u, {
        method: "GET", redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" },
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 404 || res.status === 410) return "gone";
      if (res.status === 403 || res.status === 429 || res.status === 503) return "blocked";
      return "parse_fail"; // page exists (2xx/3xx) but the scraper extracted no price
    } catch { return "network"; }
  };

  let fetched = 0, ingested = 0, nulls = 0, errors = 0;
  const nullClasses: Record<string, number> = {};
  const goneOffers: Array<{ cid: string; slug: string; url: string; last_observed: string | null }> = [];
  const perStoreResult: Record<string, { ok: number; null_: number; err: number }> = {};
  for (const t of picked) {
    const r = (perStoreResult[t.slug] ??= { ok: 0, null_: 0, err: 0 });
    try {
      const scraper = orch.getScraperForStore(t.slug);
      if (!scraper) { errors++; r.err++; console.error(`  no scraper for ${t.slug}`); continue; }
      const product = await scraper.updateProductPrice(t.raw_url!);
      fetched++;
      if (product && product.current_price > 0) {
        // Same production write path as the orchestrator's price loop: the observation
        // lands in raw_observations and the hourly scheduler normalizes it (ADR-099 —
        // this script never runs the chain itself).
        const saved = await ingestion.ingestBatch(t.slug, [product], STORE_ID[t.slug], null);
        if (saved > 0) {
          ingested++; r.ok++;
          // HEAL: a successful observation of the pair retires any standing delist signal —
          // re-listed offers rejoin comparison the moment they are seen again.
          await pgc.query(`delete from tps_offer_delist_signals where canonical_product_id = $1 and store_slug = $2`, [t.cid, t.slug])
            .catch((e) => console.error(`  heal failed ${t.slug}: ${e.message}`));
        } else { errors++; r.err++; }
      } else {
        nulls++; r.null_++;
        const cls = await classifyNull(t.raw_url!);
        nullClasses[cls] = (nullClasses[cls] ?? 0) + 1;
        if (cls === "gone") {
          goneOffers.push({ cid: t.cid, slug: t.slug, url: t.raw_url!, last_observed: t.last_observed });
          // ADR-196 phase 2 — persist the verdict so surfaces stop letting this offer win
          // best-price. Display name written from TPS_STORES (the one authoritative map).
          const display = TPS_STORES.find((s) => s.id === STORE_ID[t.slug])?.name ?? t.slug;
          await pgc.query(
            `insert into tps_offer_delist_signals (canonical_product_id, store_slug, store_display_name, url, status_code)
             values ($1, $2, $3, $4, 404)
             on conflict (canonical_product_id, store_slug)
             do update set url = excluded.url, observed_gone_at = now()`,
            [t.cid, t.slug, display, t.raw_url],
          ).catch((e) => console.error(`  signal write failed ${t.slug}: ${e.message}`));
        }
        console.log(`  NULL(${cls}) ${t.slug} ${String(t.raw_url).slice(0, 80)}`);
      }
    } catch (e) {
      errors++; r.err++;
      console.error(`  ERR ${t.slug}: ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((res) => setTimeout(res, 1500)); // polite pacing on top of scraper delays
  }

  // Durable evidence per run (docs/evidence pattern): the gone list is the input to the
  // ADR-196 phase-2 delisting verdict — never a claim on its own, always re-verifiable.
  if (goneOffers.length) {
    const { writeFileSync, mkdirSync } = await import("fs");
    mkdirSync("docs/evidence", { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    writeFileSync(`docs/evidence/reobserve-gone-${stamp}.json`,
      JSON.stringify({ measured_at: new Date().toISOString(), method: "updateProductPrice null + direct GET status 404/410", offers: goneOffers }, null, 2));
  }

  await pgc.end();

  console.log(JSON.stringify({
    mode: "LIVE", stale_pairs: targets.length, no_url: noUrl, attempted: picked.length,
    fetched, ingested, nulls, null_classes: nullClasses, gone_offers: goneOffers.length,
    errors, per_store: perStoreResult,
    note: "observations queued for the hourly normalizer; re-measure after the next chain tick",
  }, null, 2));
  process.exit(errors > 0 && ingested === 0 ? 1 : 0);
})().catch((e) => { console.error("ERR", e instanceof Error ? e.message : e); process.exit(1); });
