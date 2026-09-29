// scripts/tps-core/build-listing-facts.ts
// Materialize per-LISTING price facts (store + product URL) from raw_observations
// → tps_listing_price_facts, with a deterministic Discount-Integrity verdict per
// listing. Listing keys are stable across canonical rebuilds, so this preserves the
// full observed history (unlike canonical-keyed price intelligence, which resets on
// identity migration). Read-only on raw_observations; upsert only to the facts table.
//
// ADR-058 — listings are grouped by `stableListingKey` rather than the raw URL
// (Amazon embeds per-request tracking in URLs). Aggregation lives in TypeScript so
// the key rule has exactly one implementation (src/lib/identity/listing-key.ts).
//
// ADR-392 (2026-09-29, Supabase egress incident) — this step used to reset its cursor
// to 0 on EVERY hourly run and page the WHOLE raw_observations table for six stores
// through the Shared Pooler. That single read pattern is what burned the org's egress
// quota. Now:
//   • KILL SWITCH: the script is a no-op unless OBSERVATION_SYNC_ENABLED=1|true.
//   • INCREMENTAL (default): per-store watermark in tps_listing_facts_sync; each run
//     reads only `id > watermark`, in ORDER BY id batches of --batch (default 2000),
//     folds them into the EXISTING facts rows (src/lib/intelligence/listing-facts-merge.ts)
//     and advances the watermark only after that batch's upsert succeeded. A failure
//     never resets the watermark. Only the columns the facts need are selected —
//     never the full payload.
//   • FULL REBUILD is a separate explicit command (`--full`, npm run
//     tps:listing-facts-backfill) that is NOT scheduled and is the only mode that
//     reconciles stale keys.
//
//   npm run tps:refresh                       # chain — facts step incremental (if enabled)
//   npx tsx scripts/tps-core/build-listing-facts.ts --dry            # preview, no writes
//   npx tsx scripts/tps-core/build-listing-facts.ts --once           # one batch per store
//   npx tsx scripts/tps-core/build-listing-facts.ts --store=2 --batch=1000 --max-batches=10
//   npm run tps:listing-facts-backfill -- --dry                       # full rebuild preview
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { readFileSync } from "fs";
import { Client } from "pg";
import { assertFingerprint } from "./tps-batch";
import { resolveListingIdentity, isSaudiMarket } from "../../src/lib/identity/merchant-listing-identity";
import {
  aggregateObservations, mergeIntoExisting, verdictFor,
  type ListingFactsRow, type ListingObservation,
} from "../../src/lib/intelligence/listing-facts-merge";

// ── flags ────────────────────────────────────────────────────────────────────
const ENABLED = /^(1|true)$/i.test(process.env.OBSERVATION_SYNC_ENABLED ?? "");
const DRY = process.argv.includes("--dry");
const FULL = process.argv.includes("--full");
const ONCE = process.argv.includes("--once");
function intFlag(name: string, dflt: number, lo: number, hi: number): number {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  const v = a ? parseInt(a.slice(name.length + 3), 10) : NaN;
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
}
const BATCH = intFlag("batch", 2000, 500, 5000);
const MAX_BATCHES = ONCE ? 1 : intFlag("max-batches", 50, 1, 100000);
const ONLY_STORE = intFlag("store", 0, 0, 1_000_000);

const ALL_STORES = [1, 2, 3, 4, 5, 8]; // ADR-060: SWSG (8) added — it was ingesting but had no price facts.
const STORES = ONLY_STORE ? [ONLY_STORE] : ALL_STORES;
/** Slugs drive the per-store durable-id extractors in `stableListingKey`. */
const STORE_SLUG: Record<number, string> = {
  1: "jarir", 2: "amazon", 3: "noon", 4: "extra", 5: "almanea", 8: "swsg",
};

const log = (event: string, fields: Record<string, unknown>) =>
  console.log(JSON.stringify({ event, mode: FULL ? "full" : "incremental", dry: DRY, ...fields }));

// Only the columns the facts need — the payload jsonb is projected server-side, never
// shipped whole. Ordered by id so the watermark is a plain "highest id folded in".
const OBS_SQL = `
  select id, raw_name name, scraped_at,
         coalesce(payload->>'productUrl', payload->>'url', payload->>'product_url', raw_url) listing,
         nullif(regexp_replace(coalesce(payload->>'sellingPrice', payload->>'price', payload->>'current_price'),'[^0-9.]','','g'),'')::numeric price,
         nullif(regexp_replace(coalesce(payload->>'wasPrice', payload->>'original_price'),'[^0-9.]','','g'),'')::numeric was,
         coalesce(payload->>'brandEn', payload->>'brand') brand,
         coalesce(payload->>'category', payload->>'categoryEn') category
  from raw_observations
  where store_id = $1 and id > $2
  order by id asc
  limit $3`;

const FACTS_COLS = `listing_key, store_id, url, name, brand, category, current_price, observed_min, observed_max,
                    claimed_was, distinct_days, first_seen, last_seen, observed_days::text[] observed_days`;

function toRow(r: Record<string, unknown>): ListingFactsRow {
  return {
    listing_key: String(r.listing_key), store_id: Number(r.store_id), url: String(r.url ?? ""),
    name: (r.name as string | null) ?? null, brand: (r.brand as string | null) ?? null,
    category: (r.category as string | null) ?? null,
    current_price: Number(r.current_price), observed_min: Number(r.observed_min), observed_max: Number(r.observed_max),
    claimed_was: r.claimed_was == null ? null : Number(r.claimed_was),
    distinct_days: Number(r.distinct_days ?? 0),
    first_seen: new Date(r.first_seen as string), last_seen: new Date(r.last_seen as string),
    observed_days: Array.isArray(r.observed_days) ? (r.observed_days as string[]).map((d) => String(d).slice(0, 10)) : null,
  };
}

/** Group a page of observations by stable listing key. Returns per-key aggregates. */
function aggregatePage(store: number, page: Record<string, unknown>[], skipped: { foreign: number }): Map<string, ListingFactsRow> {
  const byKey = new Map<string, ListingObservation[]>();
  for (const r of page) {
    const ident = resolveListingIdentity(store, r.listing as string | null, STORE_SLUG[store]);
    if (!ident.key) continue;
    // MARKET SCOPING (ADR-059): non-Saudi Jarir listings stay immutable evidence in
    // raw_observations but never produce Saudi facts.
    if (!isSaudiMarket(ident.market)) { skipped.foreign++; continue; }
    const list = byKey.get(ident.key) ?? [];
    list.push({
      id: Number(r.id), listing: String(r.listing), name: (r.name as string | null) ?? null,
      brand: (r.brand as string | null) ?? null, category: (r.category as string | null) ?? null,
      price: r.price == null ? null : Number(r.price), was: r.was == null ? null : Number(r.was),
      at: new Date(r.scraped_at as string),
    });
    byKey.set(ident.key, list);
  }
  const out = new Map<string, ListingFactsRow>();
  for (const [key, obs] of byKey) {
    const agg = aggregateObservations(key, store, obs);
    if (agg) out.set(key, agg);
  }
  return out;
}

const UPSERT_COLS = 21;
async function upsertRows(pg: Client, rows: ListingFactsRow[], tally: Record<string, number>): Promise<number> {
  let written = 0;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const vals: string[] = []; const params: unknown[] = [];
    let j = 0;
    for (const r of chunk) {
      const v = verdictFor(r);
      if (!v) continue; // no observed price yet → no verdict, no row
      tally[v.verdict] = (tally[v.verdict] ?? 0) + 1;
      const b = j * UPSERT_COLS;
      vals.push(`(${Array.from({ length: UPSERT_COLS }, (_, k) => `$${b + k + 1}`).join(",")})`);
      params.push(
        r.listing_key, r.store_id, String(r.store_id), r.url, (r.name ?? "").slice(0, 400),
        r.brand ?? null, r.category ?? null, r.current_price, r.observed_min, r.observed_max,
        r.claimed_was, r.distinct_days, r.first_seen, r.last_seen,
        v.verdict, v.advertisedSavingPct, v.realSavingPct, v.text.ar, v.text.en,
        r.observed_days ?? null, new Date(),
      );
      j++;
    }
    if (!vals.length) continue;
    written += j;
    if (DRY) continue;
    await pg.query(
      `insert into tps_listing_price_facts
         (listing_key, store_id, store_name, url, name, brand, category, current_price, observed_min, observed_max,
          claimed_was, distinct_days, first_seen, last_seen, verdict, advertised_saving_pct, real_saving_pct, text_ar, text_en,
          observed_days, updated_at)
       values ${vals.join(",")}
       on conflict (listing_key) do update set
         current_price=excluded.current_price, observed_min=excluded.observed_min, observed_max=excluded.observed_max,
         claimed_was=excluded.claimed_was, distinct_days=excluded.distinct_days, first_seen=excluded.first_seen,
         last_seen=excluded.last_seen, verdict=excluded.verdict, advertised_saving_pct=excluded.advertised_saving_pct,
         real_saving_pct=excluded.real_saving_pct, text_ar=excluded.text_ar, text_en=excluded.text_en,
         name=excluded.name, brand=excluded.brand, category=excluded.category,
         observed_days=excluded.observed_days, updated_at=excluded.updated_at`,
      params,
    );
  }
  return written;
}

async function readWatermark(pg: Client, store: number): Promise<number> {
  const { rows } = await pg.query(`select last_observation_id from tps_listing_facts_sync where store_id = $1`, [store]);
  return rows.length ? Number(rows[0].last_observation_id) : 0;
}

async function writeWatermark(pg: Client, store: number, id: number, fetched: number, written: number, note: string, success: boolean) {
  if (DRY) return;
  await pg.query(
    `insert into tps_listing_facts_sync (store_id, last_observation_id, last_run_at, last_success_at, last_rows_fetched, last_rows_written, last_note, updated_at)
     values ($1, $2, now(), case when $6 then now() else null end, $3, $4, $5, now())
     on conflict (store_id) do update set
       last_observation_id = greatest(tps_listing_facts_sync.last_observation_id, excluded.last_observation_id),
       last_run_at = now(),
       last_success_at = case when $6 then now() else tps_listing_facts_sync.last_success_at end,
       last_rows_fetched = excluded.last_rows_fetched, last_rows_written = excluded.last_rows_written,
       last_note = excluded.last_note, updated_at = now()`,
    [store, id, fetched, written, note.slice(0, 200), success],
  );
}

/** Incremental: fold only observations newer than the store's watermark. */
async function syncStoreIncremental(pg: Client, store: number, tally: Record<string, number>) {
  const t0 = Date.now();
  const before = await readWatermark(pg, store);
  let watermark = before, fetched = 0, written = 0, bytes = 0, batches = 0, drained = false;
  const skipped = { foreign: 0 };
  try {
    for (; batches < MAX_BATCHES; batches++) {
      const { rows: page } = await pg.query(OBS_SQL, [store, watermark, BATCH]);
      if (!page.length) { drained = true; break; }
      fetched += page.length;
      for (const r of page) bytes += JSON.stringify(r).length;
      const lastId = Number(page[page.length - 1].id);
      const agg = aggregatePage(store, page as Record<string, unknown>[], skipped);
      const keys = [...agg.keys()];
      const existing = new Map<string, ListingFactsRow>();
      if (keys.length) {
        const { rows } = await pg.query(`select ${FACTS_COLS} from tps_listing_price_facts where listing_key = any($1)`, [keys]);
        for (const r of rows) existing.set(String(r.listing_key), toRow(r as Record<string, unknown>));
      }
      const merged = keys.map((k) => mergeIntoExisting(existing.get(k) ?? null, agg.get(k)!));
      written += await upsertRows(pg, merged, tally);
      // Advance ONLY after this batch's rows are written (or would be, in --dry).
      watermark = lastId;
      await writeWatermark(pg, store, watermark, fetched, written, `batch ${batches + 1} ok`, true);
      if (page.length < BATCH) { drained = true; batches++; break; }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await writeWatermark(pg, store, watermark, fetched, written, `fail: ${msg}`, false).catch(() => undefined);
    log("listing_facts_sync", {
      store_id: store, ok: false, error: msg.slice(0, 200), rows_fetched: fetched, rows_written: written,
      watermark_before: before, watermark_after: watermark, batches, duration_ms: Date.now() - t0, approx_bytes: bytes,
    });
    throw e;
  }
  log("listing_facts_sync", {
    store_id: store, ok: true, rows_fetched: fetched, rows_written: written, non_saudi_skipped: skipped.foreign,
    watermark_before: before, watermark_after: watermark, batches, drained,
    duration_ms: Date.now() - t0, approx_bytes: bytes,
  });
  return { fetched, written };
}

/** Full rebuild: the pre-ADR-392 algorithm, explicit and unscheduled. Reconciles stale keys. */
async function rebuildStoreFull(pg: Client, store: number, tally: Record<string, number>) {
  const t0 = Date.now();
  const agg = new Map<string, ListingFactsRow>();
  const skipped = { foreign: 0 };
  let cursor = 0, fetched = 0, bytes = 0;
  for (;;) {
    const { rows: page } = await pg.query(OBS_SQL, [store, cursor, BATCH]);
    if (!page.length) break;
    fetched += page.length;
    for (const r of page) bytes += JSON.stringify(r).length;
    cursor = Number(page[page.length - 1].id);
    for (const [k, batch] of aggregatePage(store, page as Record<string, unknown>[], skipped)) {
      agg.set(k, mergeIntoExisting(agg.get(k) ?? null, batch));
    }
  }
  const rows = [...agg.values()];
  const written = await upsertRows(pg, rows, tally);
  // Reconcile stale keys — only meaningful when the WHOLE history was replayed.
  const keys = rows.filter((r) => verdictFor(r)).map((r) => r.listing_key);
  const { rows: st } = await pg.query(`select count(*)::int n from tps_listing_price_facts where store_id = $1 and not (listing_key = any($2))`, [store, keys]);
  const stale = st[0]?.n ?? 0;
  if (stale > 0 && !DRY) await pg.query(`delete from tps_listing_price_facts where store_id = $1 and not (listing_key = any($2))`, [store, keys]);
  await writeWatermark(pg, store, cursor, fetched, written, "full rebuild", true);
  log("listing_facts_full_rebuild", {
    store_id: store, ok: true, rows_fetched: fetched, rows_written: written, stale_removed: DRY ? 0 : stale,
    stale_found: stale, non_saudi_skipped: skipped.foreign, watermark_after: cursor, duration_ms: Date.now() - t0, approx_bytes: bytes,
  });
  return { fetched, written };
}

(async () => {
  if (!ENABLED) {
    // Kill switch (ADR-392). Exit 0 so the refresh chain records a skip, not a failure.
    log("listing_facts_skipped", { reason: "OBSERVATION_SYNC_ENABLED is not 1/true — no observation reads performed" });
    return;
  }
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  // Incremental batches are small and indexed ((store_id, id)); a full replay is not.
  await pg.query(`set statement_timeout = ${FULL ? 0 : 120000}`);
  await pg.query(readFileSync(resolve(process.cwd(), "scripts/database/knowledge-db/021_listing_price_facts.sql"), "utf8"));
  await pg.query(readFileSync(resolve(process.cwd(), "scripts/database/knowledge-db/035_listing_facts_sync_state.sql"), "utf8"));

  const tally: Record<string, number> = {};
  let fetched = 0, written = 0;
  const t0 = Date.now();
  for (const store of STORES) {
    const r = FULL ? await rebuildStoreFull(pg, store, tally) : await syncStoreIncremental(pg, store, tally);
    fetched += r.fetched; written += r.written;
  }
  log("listing_facts_done", { stores: STORES, rows_fetched: fetched, rows_written: written, duration_ms: Date.now() - t0, verdicts: tally });
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
