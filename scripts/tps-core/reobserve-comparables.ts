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
import { TARGET_SQL, CLAIM_WINDOW_HOURS, KEEP_FROM_HOURS, pickTargets } from "./reobserve-targets";

const args = process.argv.slice(2);
const GO = args.includes("--go");
const num = (name: string, d: number) => parseInt(args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] || String(d), 10);
const LIMIT = num("limit", 50);
const PER_STORE = num("per-store", 25);
const INCLUDE_REVIVE = args.includes("--revive");
const ONLY_STORES = args.find((a) => a.startsWith("--stores="))?.split("=")[1]?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;

// Same identity maps as seeded-discovery.ts — store_name namespaces as written into
// price_history / normalized_product_observations, and the numeric TPS store ids.
const STORE_ID: Record<string, number> = { noon: 3, extra: 4, almanea: 5, amazon: 2, jarir: 1, swsg: 8, shaker: 7, najm: 9, alnakheelk: 18, samsung_ksa: 6 };
const STORE_NAMES: Record<string, string[]> = {
  samsung_ksa: ['سامسونج السعودية', 'samsung_ksa', '6'],
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

type Target = { rank: 1 | 2 | 3; cid: string; slug: string; raw_url: string | null; raw_name: string; last_observed: string | null; tps_identity_key: string | null; url_source: "npo" | "legacy_raw" | null; last_price: number | null };

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn") || url.includes("ffpsjjazsluolysgithg")) {
    console.error("refusing: not production"); process.exit(1);
  }
  const newClient = () => { const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } }); c.on('error', (e) => console.error(`  pg client error (ignored): ${e.message}`)); return c; };
  const pgc = newClient();
  await pgc.connect();
  // The selection connection is closed as soon as the targets are read. A LIVE run spends minutes in slow merchant fetches: a connection held idle through them is
  // killed by the pooler ("Connection terminated unexpectedly", an unhandled 'error' event that crashed the process, 2026-10-10). Writes open a short-lived client.
  const withDb = async <R,>(fn: (c: pg.Client) => Promise<R>): Promise<R> => { const c = newClient(); await c.connect(); try { return await fn(c); } finally { await c.end().catch(() => {}); } };

  // TARGET SELECTION (rewritten 2026-10-10): the old query scanned all of price_history + a correlated max() over normalized_product_observations and has
  // timed out on every run since 2026-10-01. Now one cheap read of the hot current-state table, ranked by what a fetch buys — see reobserve-targets.ts.
  const SLUG_BY_ID = new Map(Object.entries(STORE_ID).map(([slug, id]) => [id, slug]));
  const { rows: rawTargets } = await pgc.query<{ cid: string; sid: number; raw_url: string | null; raw_name: string; last_observed: string | null; tps_identity_key: string; last_price: number | null; rank: number }>(
    TARGET_SQL, [Object.values(STORE_ID), CLAIM_WINDOW_HOURS, KEEP_FROM_HOURS],
  );
  const targets: Target[] = rawTargets.flatMap((r) => {
    const slug = SLUG_BY_ID.get(r.sid);
    return slug ? [{ cid: r.cid, slug, raw_url: r.raw_url, raw_name: r.raw_name, last_observed: r.last_observed, tps_identity_key: r.tps_identity_key, url_source: "npo" as const, last_price: r.last_price, rank: r.rank as 1 | 2 | 3 }] : [];
  });

  await pgc.end().catch(() => {});

  // Bound the run: per-store cap first (throttle safety — amazon especially; noon is cost-sensitive), then total. Rank 1 (restore a comparison) first.
  const { picked, perStore, noUrl } = pickTargets(targets, {
    limit: LIMIT, perStore: PER_STORE, onlyStores: ONLY_STORES, includeRank3: INCLUDE_REVIVE,
    perStoreCaps: { noon: num("noon-cap", 12), amazon: num("amazon-cap", 20) },
  });
  const rankCounts = picked.reduce((a, t) => { const k = "r" + t.rank; a[k] = (a[k] ?? 0) + 1; return a; }, {} as Record<string, number>);
  const srcCounts = picked.reduce((a, t) => { a[t.url_source ?? "npo"] = (a[t.url_source ?? "npo"] ?? 0) + 1; return a; }, {} as Record<string, number>);
  console.log(`reobserve-comparables — ${GO ? "LIVE" : "DRY"} — candidate offers ${targets.length} (no-url ${noUrl}) → picked ${picked.length} (limit ${LIMIT}, per-store ${PER_STORE}, window ${CLAIM_WINDOW_HOURS}h) · ranks ${JSON.stringify(rankCounts)} · url sources ${JSON.stringify(srcCounts)}`);
  for (const [slug, c] of perStore) console.log(`  ${slug.padEnd(12)} ${c}`);
  if (!GO) {
    for (const t of picked.slice(0, 15)) console.log(`  r${t.rank} ${t.slug.padEnd(10)} last=${t.last_observed ?? "never"} ${String(t.raw_url).slice(0, 90)}`);
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
  // Stop STARTING fetches one margin before the worker's hard timeout (15 min): the run then exits through the normal path and records what it refreshed, instead
  // of being killed mid-write. Env-tunable; default leaves ~3 min of headroom for the in-flight fetch and the close-out.
  const SOFT_DEADLINE_MS = parseInt(process.env.REOBSERVE_SOFT_DEADLINE_MS || String(12 * 60 * 1000), 10);
  const startedAt = Date.now();
  let stoppedEarly = 0;
  for (const t of picked) {
    if (Date.now() - startedAt > SOFT_DEADLINE_MS) { stoppedEarly = picked.length - fetched - nulls - errors; console.log(`  soft deadline reached after ${Math.round((Date.now() - startedAt) / 1000)}s — ${stoppedEarly} target(s) left for the next run`); break; }
    const r = (perStoreResult[t.slug] ??= { ok: 0, null_: 0, err: 0 });
    try {
      const scraper = orch.getScraperForStore(t.slug);
      if (!scraper) { errors++; r.err++; console.error(`  no scraper for ${t.slug}`); continue; }
      const product = await scraper.updateProductPrice(t.raw_url!);
      fetched++;
      // ADR-200 PRICE SANITY GATE — a re-observed price wildly off the pair's last known
      // price is far more likely a parse defect (add-on/related-item price on the product
      // page) than a real market move. Measured 2026-08-03: Amazon's Midea split AC parsed
      // at 59.99 SAR against a 1,609 SAR history; the single row overflowed
      // price_spread_pct and KILLED the whole projection write. Unknown beats incorrect:
      // reject and log, never ingest a suspect price. Bounds are deliberately wide (4x)
      // so real drops/spikes pass; a genuine >4x move re-verifies on the next run via a
      // fresh fetch of the same page.
      const suspect = product && product.current_price > 0 && t.last_price != null && t.last_price > 0
        && (product.current_price > t.last_price * 4 || product.current_price < t.last_price / 4);
      if (suspect) {
        nulls++; r.null_++;
        nullClasses["suspect_price"] = (nullClasses["suspect_price"] ?? 0) + 1;
        console.log(`  NULL(suspect_price) ${t.slug} parsed=${product!.current_price} last=${t.last_price} ${String(t.raw_url).slice(0, 60)}`);
      } else if (product && product.current_price > 0) {
        // Same production write path as the orchestrator's price loop: the observation
        // lands in raw_observations and the hourly scheduler normalizes it (ADR-099 —
        // this script never runs the chain itself).
        const saved = await ingestion.ingestBatch(t.slug, [product], STORE_ID[t.slug], null);
        if (saved > 0) {
          ingested++; r.ok++;
          // HEAL: a successful observation of the pair retires any standing delist signal —
          // re-listed offers rejoin comparison the moment they are seen again.
          await withDb((c) => c.query(`delete from tps_offer_delist_signals where canonical_product_id = $1 and store_slug = $2`, [t.cid, t.slug]))
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
          await withDb((c) => c.query(
            `insert into tps_offer_delist_signals (canonical_product_id, store_slug, store_display_name, url, status_code)
             values ($1, $2, $3, $4, 404)
             on conflict (canonical_product_id, store_slug)
             do update set url = excluded.url, observed_gone_at = now()`,
            [t.cid, t.slug, display, t.raw_url],
          )).catch((e) => console.error(`  signal write failed ${t.slug}: ${e.message}`));
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

  console.log(JSON.stringify({
    mode: "LIVE", stale_pairs: targets.length, no_url: noUrl, attempted: picked.length,
    fetched, ingested, nulls, null_classes: nullClasses, gone_offers: goneOffers.length,
    errors, stopped_early: stoppedEarly, per_store: perStoreResult,
    note: "observations queued for the hourly normalizer; re-measure after the next chain tick",
  }, null, 2));
  process.exit(errors > 0 && ingested === 0 ? 1 : 0);
})().catch((e) => { console.error("ERR", e instanceof Error ? e.message : e); process.exit(1); });
