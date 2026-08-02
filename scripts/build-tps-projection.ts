// scripts/build-tps-projection.ts
// ─────────────────────────────────────────────────────────────────────────────
// TPS Layer 5 — Build Projection v3 (ADR-067): SET-BASED.
//
// v2 issued ONE PostgREST round-trip per canonical to fetch its price history,
// plus one upsert each. Measured on production: **1,296 seconds (21.6 minutes)
// for 1,815 canonicals** — roughly 3,600 round-trips. Because every growth lever
// (more merchants, more categories, more products) increases the canonical count,
// this was the binding constraint on the entire strategy: at 10,000 canonicals it
// would take ~2 hours.
//
// v3 does the same work in three phases:
//   1. ONE query  — canonicals LEFT JOINed to their latest price per store,
//                   aggregated in the database.
//   2. In-process — derive the display strings. Deliberately NOT moved into SQL:
//                   `compare_url` uses JavaScript `encodeURIComponent` semantics
//                   and `text_for_search` composes optional attributes in a
//                   specific order. Reimplementing either in SQL would risk a
//                   silent behavioural drift for no performance gain.
//   3. BULK write — multi-row INSERT ... ON CONFLICT, 500 rows per statement.
//
// CORRECTNESS NOTES
// • v2 read only the 20 most recent price rows per canonical and took the first
//   occurrence of each store. v3 uses DISTINCT ON (canonical, store) ordered by
//   observed_at DESC — the latest price per store with no arbitrary cap.
//   Verified equivalent on current data (max 8 qualifying rows per canonical), and
//   strictly safer as history deepens: v2 would have begun silently dropping
//   stores — and therefore losing comparisons — once any canonical exceeded 20 rows.
// • The `tps_observation_id IS NOT NULL` filter, the `price > 0` filter, the
//   >=2-store comparison rule, rounding, and the ON CONFLICT (tps_identity_key)
//   upsert semantics are all preserved exactly.
// • Idempotent: re-running over unchanged evidence produces identical rows.
// • Never deletes ON PRICE LOSS. A canonical that loses its prices keeps its row
//   with store_count 0, exactly as under v2.
// • DEACTIVATION IS DIFFERENT, and was not honoured at all until 2026-08-02. The
//   source query had no `is_active` filter and this builder never deleted, so
//   `is_active = false` did nothing a customer could see: 303 deactivated canonicals
//   were still being served, 14 of them still displaying a multi-store COMPARISON.
//   Four of those are the appliance `…|NA` canonicals ADR-118 deactivated precisely
//   because their comparison was false — the decision was recorded, the write was
//   made, and the customer kept seeing the comparison for two weeks. Deactivation now
//   filters here AND prunes the serving row, because a serving table that cannot
//   forget is not a projection of the truth.
//
// Usage: npx tsx scripts/build-tps-projection.ts [--dry] [--quiet]
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { TPS_STORES } from "./tps-core/category-registry";

// ADR-082: some price_history rows carry the numeric store_id as store_name (a
// fallback from before a store was added to TPS_STORES). price_history is
// append-only, so we cannot rewrite them — instead collapse numeric store_names to
// their canonical display name at READ time, so a store never counts twice (e.g. a
// legacy '7' and a new 'شاكر' must be the ONE store shaker, not two → no false
// comparison). Names are Arabic literals with no embedded quotes (SQL-safe).
const STORE_NAME_CASE = `case ph.store_name ${TPS_STORES.map((s) => `when '${s.id}' then '${s.name}'`).join(" ")} else ph.store_name end`;

const DRY = process.argv.includes("--dry");
const QUIET = process.argv.includes("--quiet") || DRY;

interface Row {
  canonical_id: string;
  tps_identity_key: string;
  name_ar: string | null;
  name_en: string | null;
  brand: string | null;
  category: string | null;
  identity_confidence: number | null;
  attributes: Record<string, unknown> | null;
  /** Latest price per store, ascending. Parallel arrays from the aggregate. */
  stores: string[] | null;
  prices: string[] | null;
  /** Most recent priced observation across stores — per-product freshness (ADR-088). */
  last_observed_at: string | null;
}

/** Exactly the v2 composition, order preserved. */
function attrText(attrs: Record<string, unknown>): string {
  return [
    attrs.capacity_btu ? `${attrs.capacity_btu} BTU` : null,
    attrs.technology,
    attrs.cooling_mode === "hot_cold" ? "حار وبارد hot and cold" : null,
    attrs.cooling_mode === "cool_only" ? "بارد فقط cool only" : null,
    attrs.ac_type,
    attrs.series_or_platform,
    attrs.storage_gb ? `${attrs.storage_gb}GB` : null,
    attrs.family,
    attrs.generation,
    attrs.variant,
  ].filter(Boolean).join(" ");
}

/** Pure, testable derivation of one projection row from its aggregated evidence. */
export function deriveProjection(r: Row) {
  // Deterministic ordering: price, then store name. v2 left ties to whatever
  // order the database happened to return, so `cheapest_store` (and the
  // `text_for_search` that embeds it) could change between runs on identical
  // evidence — 12 of 1,815 rows were exact price ties. A projection that is not
  // reproducible cannot be verified, so ties now resolve by name.
  const pairs = (r.stores ?? []).map((store, i) => ({ store, price: Number((r.prices ?? [])[i]) }))
    .filter((s) => Number.isFinite(s.price) && s.price > 0)
    .sort((a, b) => a.price - b.price || a.store.localeCompare(b.store));

  const lowestPrice = pairs[0]?.price ?? null;
  const highestPrice = pairs.length ? pairs[pairs.length - 1].price : null;
  const cheapestStore = pairs[0]?.store ?? null;
  const storeCount = pairs.length;

  const saving = lowestPrice && highestPrice && highestPrice > lowestPrice
    ? parseFloat((highestPrice - lowestPrice).toFixed(2)) : null;
  const priceSpreadPct = lowestPrice && highestPrice && lowestPrice > 0
    ? parseFloat((((highestPrice - lowestPrice) / lowestPrice) * 100).toFixed(2)) : null;

  const textForSearch = [
    r.name_ar, r.name_en, r.brand, r.category, cheapestStore,
    lowestPrice ? `${lowestPrice} ريال` : null,
    attrText(r.attributes ?? {}),
  ].filter(Boolean).join(" ");

  return {
    canonical_id: r.canonical_id,
    tps_identity_key: r.tps_identity_key,
    display_name_ar: r.name_ar,
    display_name_en: r.name_en,
    brand: r.brand,
    category: r.category,
    lowest_price: lowestPrice,
    highest_price: highestPrice,
    saving,
    price_spread_pct: priceSpreadPct,
    cheapest_store: cheapestStore,
    store_count: storeCount,
    has_comparison: storeCount >= 2,
    compare_url: r.tps_identity_key ? `/ar/compare/${encodeURIComponent(r.tps_identity_key)}` : null,
    identity_confidence: r.identity_confidence,
    text_for_search: textForSearch,
    last_observed_at: r.last_observed_at,
  };
}

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("SUPABASE_DB_URL missing");
  // Production guard: accept BOTH the direct host (db.<ref>.supabase.co) AND the
  // IPv4 pooler form (user `postgres.<ref>@...pooler.supabase.com`) — both carry the
  // production ref; reject legacy. The old host-only regex threw "refusing: not
  // production" on Railway once ADR-078 rewrote the URL to the pooler (ref moves
  // from the host into the username), which was the projection step's 0.4s failure.
  if (!url.includes("vyceqrzttspyycdpojtn") || url.includes("ffpsjjazsluolysgithg")) throw new Error("refusing: not production");

  const t0 = Date.now();
  const pg = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");
  let queries = 0;

  // ── PHASE 1: one set-based read ───────────────────────────────────────────
  // `latest` takes the newest priced observation per (canonical, store); the
  // aggregate then emits parallel store/price arrays already ordered by price.
  const t1 = Date.now();
  const { rows } = await pg.query<Row>(`
    with latest as (
      select distinct on (ph.canonical_product_id, ${STORE_NAME_CASE})
             ph.canonical_product_id, ${STORE_NAME_CASE} as store_name, ph.price, ph.observed_at
      from price_history ph
      where ph.tps_observation_id is not null
      order by ph.canonical_product_id, ${STORE_NAME_CASE}, ph.observed_at desc
    ),
    agg as (
      select canonical_product_id,
             array_agg(store_name order by price asc, store_name asc) as stores,
             array_agg(price::text order by price asc, store_name asc) as prices,
             -- last_observed_at = the most recent priced observation across stores; a
             -- real per-product freshness signal for the Trust Engine (ADR-088), unlike
             -- updated_at which is just the projection build time.
             max(observed_at) as last_observed_at
      from latest where price > 0
      group by canonical_product_id
    )
    select c.id::text as canonical_id, c.tps_identity_key, c.name_ar, c.name_en,
           c.brand, c.category, c.identity_confidence, c.attributes,
           a.stores, a.prices, a.last_observed_at
    from canonical_products c
    left join agg a on a.canonical_product_id = c.id
    where c.tps_identity_key is not null
      and c.is_active
    order by c.id
  `);
  queries++;
  const readMs = Date.now() - t1;

  // ── PHASE 2: derive in-process (exact v2 string semantics) ────────────────
  const projected = rows.map(deriveProjection);
  const comparable = projected.filter((p) => p.has_comparison).length;

  if (DRY) {
    console.log(JSON.stringify({
      mode: "dry", canonicals: rows.length, comparable,
      read_ms: readMs, total_ms: Date.now() - t0, queries,
    }));
    await pg.end();
    return;
  }

  // ── PHASE 3: bulk upsert ──────────────────────────────────────────────────
  // Chunked multi-row INSERT ... ON CONFLICT. Each chunk is one statement and
  // therefore atomic; a chunk either lands completely or not at all, so the table
  // never holds a half-written row. Chunking (rather than one giant statement)
  // keeps parameter counts and memory bounded as the catalogue grows.
  const COLS = [
    "canonical_id", "tps_identity_key", "display_name_ar", "display_name_en", "brand", "category",
    "lowest_price", "highest_price", "saving", "price_spread_pct", "cheapest_store", "store_count",
    "has_comparison", "compare_url", "identity_confidence", "text_for_search", "last_observed_at",
  ] as const;
  const CHUNK = 500;
  let written = 0;
  const t2 = Date.now();
  for (let i = 0; i < projected.length; i += CHUNK) {
    const chunk = projected.slice(i, i + CHUNK);
    const values: string[] = [];
    const params: unknown[] = [];
    chunk.forEach((p, j) => {
      const b = j * COLS.length;
      values.push(`(${COLS.map((_, k) => `$${b + k + 1}`).join(",")}, now())`);
      params.push(...COLS.map((c) => (p as Record<string, unknown>)[c]));
    });
    const res = await pg.query(
      `insert into tps_product_projection (${COLS.join(",")}, updated_at)
       values ${values.join(",")}
       on conflict (tps_identity_key) do update set
         canonical_id = excluded.canonical_id,
         display_name_ar = excluded.display_name_ar,
         display_name_en = excluded.display_name_en,
         brand = excluded.brand,
         category = excluded.category,
         lowest_price = excluded.lowest_price,
         highest_price = excluded.highest_price,
         saving = excluded.saving,
         price_spread_pct = excluded.price_spread_pct,
         cheapest_store = excluded.cheapest_store,
         store_count = excluded.store_count,
         has_comparison = excluded.has_comparison,
         compare_url = excluded.compare_url,
         identity_confidence = excluded.identity_confidence,
         text_for_search = excluded.text_for_search,
         last_observed_at = excluded.last_observed_at,
         updated_at = now()`,
      params
    );
    queries++;
    written += res.rowCount ?? 0;
  }
  const writeMs = Date.now() - t2;

  // ── PHASE 4: prune rows whose canonical is gone or deactivated ────────────
  // Scoped to exactly that: a row is removed only when NO active canonical claims
  // its identity key. A canonical that merely lost its prices still has an active
  // row and keeps its projection entry at store_count 0, unchanged from v2.
  const pruned = await pg.query(
    `delete from tps_product_projection p
      where not exists (
        select 1 from canonical_products c
         where c.tps_identity_key = p.tps_identity_key and c.is_active)`
  );
  queries++;
  const totalMs = Date.now() - t0;

  if (!QUIET) {
    console.log(`TPS Layer 5 — Projection v3 (set-based)`);
    console.log(`  canonicals read : ${rows.length}   (${readMs} ms, 1 query)`);
    console.log(`  rows written    : ${written}       (${writeMs} ms, ${queries - 2} statements)`);
    console.log(`  rows PRUNED     : ${pruned.rowCount ?? 0}   (canonical inactive or gone)`);
    console.log(`  comparable      : ${comparable} (>=2 stores)`);
    console.log(`  TOTAL           : ${(totalMs / 1000).toFixed(1)}s across ${queries} queries`);
  }
  await pg.end();
}

// Run ONLY when executed directly. `deriveProjection` is imported by the test
// suite, and a bare `main()` at module scope meant importing the pure function
// also opened a production connection and started a rebuild.
const executedDirectly = require.main === module ||
  process.argv[1]?.replace(/\\/g, "/").endsWith("build-tps-projection.ts");
if (executedDirectly) {
  main().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
}
