// scripts/tps-core/progressive-engine.ts
// Safe progressive TPS batching. Separates NORMALIZATION (progressive, durable
// per-(category,store) cursor, ≤500 observations/run) from CORROBORATION (global
// grouping by identity_key over the accumulated `tps_identity_staging`, so an
// early-slice product corroborates with a late-slice match). All authoritative
// writes still go through the verified atomic write_ac_batch; canonical/normalized
// ids reuse the original matcher seeds (no duplicates). Idempotent; resumable.
import type { SupabaseClient } from "@supabase/supabase-js";
import { brandOrNull } from "./store-identity-guard";
import { createHash } from "crypto";
import { pickBestUrl } from "./url-util";
import { CATEGORY_DEFS, TPS_STORES, type CategoryDef } from "./category-registry";
import { TPS_MAX_OBSERVATIONS } from "./tps-batch";
import { isValidGtin } from "../../src/lib/enrichment/icecat";

function stableUuid(seed: string): string {
  const h = createHash("sha256").update(seed).digest("hex");
  return [h.slice(0, 8), h.slice(8, 12), "4" + h.slice(13, 16), ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20), h.slice(20, 32)].join("-");
}
const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
function adaptRow(p: Record<string, unknown>, rawName: string | null) {
  const nameAr = asString(p.nameAr) ?? asString(p.name_ar) ?? asString(p.name) ?? asString(rawName) ?? "";
  const nameEn = asString(p.nameEn) ?? asString(p.name_en) ?? asString(p.title) ?? "";
  // ADR-191: a merchant feed that puts its OWN shop name in the brand field would otherwise
  // become the first segment of the identity key, fencing that listing off from every other
  // retailer selling the identical product. Rejected to null — unknown beats incorrect.
  const brand = brandOrNull(asString(p.brandEn) ?? asString(p.brand) ?? asString(p.brandAr));
  return { nameAr, nameEn, brand, url: pickBestUrl(p) };
}
function extractPrice(p: Record<string, unknown>): number | null {
  for (const c of [p.current_price, p.sellingPrice, p.price, p.wasPrice, p.original_price]) {
    const n = typeof c === "number" ? c : Number(asString(c));
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}
/** First usable http(s) product image the observation carries (never fabricated). 59% of
 *  observations have one; the canonical previously dropped them (image_url:null), so every
 *  comparison card rendered imageless. Thread it through staging so corroboration can set it. */
function extractImage(p: Record<string, unknown>): string | null {
  const arr = p.image_urls ?? p.images ?? p.image;
  const list = Array.isArray(arr) ? arr : [arr];
  for (const cand of list) {
    const s = asString(cand);
    // Reject lazy-load placeholders smuggled into an https path (e.g. shakersa/swsg serve
    // `https://host/data:image/svg…` / `;base64,` 1×1 blanks) — a fake image is worse than none.
    if (s && /^https?:\/\//i.test(s) && !/data:image|;base64,/i.test(s)) return s;
  }
  return null;
}

export interface SweepMetrics { fetched: number; staged: number; saturated: boolean; byCategory: Record<string, { detected: number; valid: number; lowConfidence: number; invalid: number; touched: Set<string> }>;
  /** DRY-RUN ONLY. The staging rows this sweep WOULD have written. Empty on a real run —
   *  they are persisted instead. Threaded to corroboratePass so a dry run can see the work it
   *  just computed; without this the dry pass reads only previously-persisted staging and
   *  under-reports its own effect to zero. */
  pendingStaging?: Record<string, unknown>[]; }

const GLOBAL = "_all_"; // cursor category for the single-pass scan

/** One staged offer as seen by `selectCurrentOffer` — the subset of `Stg` fields it needs. */
export interface StagedOfferForSelection { raw_obs_id: number; price: number | null; observed_at?: string | null }

/**
 * "Current price" for one (identity_key, store) pair = the MOST RECENTLY OBSERVED
 * priced offer, never the historically cheapest one.
 *
 * `corroboratePass` groups ALL staging ever accumulated for a touched identity_key
 * (see the load below — "across all slices ever normalized"), so this runs over a
 * store's entire observation history, not just this run's new evidence. Picking by
 * MIN(price) here (the pre-2026-08-07 behavior) meant a price could only ever fall to
 * its historic low and get stuck there permanently: a later genuine price rise is a
 * NEW staging row with a HIGHER price, which the min-reduce always loses to an older,
 * cheaper row that never leaves the table. Reproduced live (P0 incident, 2026-08-07):
 * an Amazon listing correctly re-scraped at 4,164.15 SAR twice on 2026-08-06 still lost
 * to its own 3,919 SAR staging row from 2026-07-23, so the compare page kept ranking
 * Amazon "cheapest" on a two-week-stale price. Ties keep the first-seen row.
 */
export function selectCurrentOffer<T extends StagedOfferForSelection>(priced: T[], fallback: T): T {
  if (!priced.length) return fallback;
  return priced.reduce((a, b) => {
    const ta = a.observed_at ? Date.parse(a.observed_at) : -Infinity;
    const tb = b.observed_at ? Date.parse(b.observed_at) : -Infinity;
    return tb > ta ? b : a;
  });
}

// ── Single-pass NORMALIZE across ALL categories. One id-indexed scan per store
//    (no ILIKE → no slow filter, no per-category re-scan). Each row is classified
//    by every plugin's detect(); matches are staged into their category. Global
//    per-store cursor. ≤limit observations/run. ──
/** `dry` performs the FULL read, detect, classify and identity-key computation and writes
 *  NOTHING: no cursor advance, no staging. The cursor in particular must not move, or a dry
 *  run would silently consume work the real run then never sees. */
export async function normalizeSweep(sb: SupabaseClient, defs: CategoryDef[], limit: number, onlyStores?: number[], dry = false, replayFrom?: number): Promise<SweepMetrics> {
  // `replayFrom` reads from a given raw id instead of the store cursor, so a DRY run can
  // measure observations that already sit BEHIND the cursor. Measured 2026-07-31: all
  // 103,106 discovery observations are behind their cursors — scanned, undetected, skipped —
  // so a cursor-relative sweep reports 0 and can say nothing about them. DRY ONLY: replaying
  // with writes enabled would re-stage history and is exactly the cursor-rewind hazard the
  // gate flagged.
  if (replayFrom != null && !dry) throw new Error("replayFrom is dry-run only");
  // THROUGHPUT (measured 2026-07-30): the budget used to be split evenly across ALL
  // TPS_STORES — `floor(limit / TPS_STORES.length)` — regardless of whether a store had
  // anything pending. In production only 3 of 18 stores had backlog (almanea 331,823 ·
  // jarir 64,717 · noon 563), so 15 stores consumed 15/18ths of the budget on queries
  // returning nothing: an effective ~81 rows per sweep against a nominal 500, an 84% waste.
  // That is why ingestion outran normalization and observations had no bounded
  // time-to-identity.
  //
  // Now: one query loads every cursor, a cheap indexed probe finds which stores actually
  // have work, and the budget is divided among ONLY those. Equal shares among pending
  // stores — deliberately not proportional to backlog, because proportional would let
  // almanea's 331k starve noon's 563 indefinitely and delivery guarantee matters more than
  // raw rows/second. Order, identity logic and cursor semantics are unchanged.
  const { data: curRows } = await sb
    .from("tps_progress_cursors").select("store_id, last_raw_id").eq("category", GLOBAL);
  const cursorOf = new Map<number, number>(
    ((curRows ?? []) as { store_id: number; last_raw_id: number | string }[])
      .map((r) => [Number(r.store_id), Number(r.last_raw_id ?? 0)]),
  );

  // `onlyStores` narrows the sweep to specific stores. Equal-share division means a
  // whole-fleet run drains every lagging store at once, which is right for routine
  // delivery but makes a per-store DELTA unattributable — you cannot say what draining
  // almanea was worth if jarir drained in the same pass. Absent = every store, i.e.
  // unchanged behaviour for the scheduler and for a plain `normalize-incremental`.
  const pending: { store: typeof TPS_STORES[number]; last: number }[] = [];
  for (const s of TPS_STORES) {
    if (onlyStores && !onlyStores.includes(s.id)) continue;
    const last = replayFrom != null ? replayFrom : (cursorOf.get(s.id) ?? 0);
    const { data: probe } = await sb
      .from("raw_observations").select("id").eq("store_id", s.id).gt("id", last).limit(1);
    if ((probe ?? []).length) pending.push({ store: s, last });
  }

  const perStore = Math.max(1, Math.floor(limit / Math.max(1, pending.length)));
  const m: SweepMetrics = { fetched: 0, staged: 0, saturated: false, byCategory: {} };
  for (const d of defs) m.byCategory[d.category] = { detected: 0, valid: 0, lowConfidence: 0, invalid: 0, touched: new Set() };
  const stagingRows: Record<string, unknown>[] = [];
  for (const { store: s, last } of pending) {
    // `scraped_at` is WHEN WE ACTUALLY SAW THE PRICE. It must travel with the row: the
    // pipeline previously stamped every downstream timestamp with the processing time, which
    // is on average 6.4 DAYS later than the observation (measured 2026-07-31 across 296,339
    // staged rows; 71.9% staged >24h after the scrape, max 43.3 days).
    const { data, error } = await sb.from("raw_observations").select("id, store_id, raw_name, payload, scraped_at").eq("store_id", s.id).gt("id", last).order("id", { ascending: true }).limit(perStore);
    if (error) throw new Error(`fetch store ${s.id}: ${error.message}`);
    const rows = (data ?? []) as { id: number; store_id: number | null; raw_name: string | null; payload: Record<string, unknown> | null; scraped_at: string | null }[];
    m.fetched += rows.length;
    let maxId = last;
    for (const row of rows) {
      if (row.id > maxId) maxId = row.id;
      const p = row.payload ?? {};
      const { nameAr, nameEn, brand, url } = adaptRow(p, row.raw_name);
      for (const def of defs) {
        if (!def.plugin.detect(nameAr, nameEn)) continue;
        const cm = m.byCategory[def.category]; cm.detected++;
        const norm = def.normalize(nameAr, nameEn, brand, p);
        const identity = def.plugin.buildIdentityKey(brand, norm.payload, { model_number: norm.model_number });
        if (identity.status === "invalid" || !identity.key) { cm.invalid++; continue; }
        if (identity.status === "low_confidence_candidate") cm.lowConfidence++; else cm.valid++;
        const conf = def.plugin.scoreConfidence(brand, norm.payload, norm.model_number, norm.ambiguity_flags);
        cm.touched.add(identity.key);
        const rawImg = extractImage(p);
        stagingRows.push({
          category: def.category, raw_obs_id: row.id, store_id: row.store_id, identity_key: identity.key,
          status: identity.status, price: extractPrice(p), url, name: (nameEn || nameAr).slice(0, 300),
          confidence: conf.confidence, detected: true,
          // Carry the observed image (and GTIN when present) alongside the normalized attrs so
          // corroboration can set canonical.image_url / attributes.gtin without re-reading raw.
          payload: { ...norm.payload, ...(rawImg ? { _image: rawImg } : {}), ...(isValidGtin(p.gtin as string) ? { _gtin: String(p.gtin).replace(/\D+/g, "") } : {}) },
          // The OBSERVATION's time, not the processing time. Falls back to now only when the
          // source row has no timestamp at all, so a missing value can never silently become
          // "observed just now" for a row we know is older.
          observed_at: row.scraped_at ?? new Date().toISOString(),
        });
      }
    }
    if (!dry) {
      const { error: ce } = await sb.from("tps_progress_cursors").upsert({ category: GLOBAL, store_id: s.id, last_raw_id: maxId, updated_at: new Date().toISOString() }, { onConflict: "category,store_id" });
      if (ce) throw new Error(`cursor upsert store ${s.id}: ${ce.message}`);
    }
  }
  // ADR-252: the sweep's rows are ALWAYS carried in memory to the corroborate pass
  // (forward-only processing consumes them directly — no history re-read). Real runs
  // still persist staging as the append-only COLD audit trail.
  m.pendingStaging = stagingRows;
  if (!dry) {
    for (let i = 0; i < stagingRows.length; i += 500) {
      const { error } = await sb.from("tps_identity_staging").upsert(stagingRows.slice(i, i + 500), { onConflict: "category,raw_obs_id" });
      if (error) throw new Error(`staging upsert: ${error.message}`);
    }
  }
  m.staged = stagingRows.length;
  m.saturated = m.fetched === 0;
  return m;
}

export interface CorroborateMetrics { keysConsidered: number; corroborated: number; singleStore: number; canonicalsWritten: number; normalized: number; matches: number; prices: number; }

export interface CorroborateOpts {
  singleStore?: boolean; // singleStore=true writes the resolved-single (Layer 2, has_comparison=false) products
  /** Compute everything, call write_ac_batch NEVER. Metrics still report what WOULD be written. */
  dry?: boolean;
  /** THIS SWEEP'S freshly-staged rows (in memory, real and dry runs alike). Forward-only
   *  processing (ADR-252): the pass consumes ONLY these new rows plus the small
   *  `tps_current_offers` current state — it never re-reads staging history. */
  sweepRows?: Record<string, unknown>[];
}

// ── Corroboration pass: for the touched keys, group ALL accumulated staging by
//    identity_key. Default writes ≥2-store comparable canonicals (Layer 1). With
//    {singleStore:true} it writes EXACTLY-1-store resolved canonicals (Layer 2:
//    known identity, one offer, comparison_available=false). Both via
//    write_ac_batch. Idempotent; only touched keys are (re)written per run. ──
export async function corroboratePass(sb: SupabaseClient, def: CategoryDef, touchedKeys: string[], opts: CorroborateOpts = {}): Promise<CorroborateMetrics> {
  const R: CorroborateMetrics = { keysConsidered: touchedKeys.length, corroborated: 0, singleStore: 0, canonicalsWritten: 0, normalized: 0, matches: 0, prices: 0 };
  if (!touchedKeys.length) return R;
  const single = !!opts.singleStore;

  // ── FORWARD-ONLY INPUT (ADR-252, SEV-1 remediation) ────────────────────────────────
  // The 2026-08-15 SEV-1 proved the structural rule this pass now enforces:
  // PROCESSING A NEW OBSERVATION MUST NEVER REQUIRE RE-READING A KEY'S OBSERVATION
  // HISTORY. The previous design loaded every touched key's ENTIRE append-only staging
  // history (719k rows, avg 177 rows/key) — first silently truncated by PostgREST's
  // 1,000-row cap (ADR-251: the 10× npo collapse), then, once paginated, so IO-heavy
  // that its first full run exhausted the Supabase Disk IO Budget and took the consumer
  // surface down.
  //
  // The pass now consumes exactly two inputs, both bounded:
  //   (a) THIS sweep's freshly-staged rows — already in memory, zero table reads;
  //   (b) `tps_current_offers` — the small HOT current state, ≤ one row per
  //       (key × store), independent of history depth. 10× the observations = the
  //       same cost.
  // `tps_identity_staging` remains an append-only COLD audit trail that the hot path
  // never reads. The old touch-triggered self-heal is REMOVED (it was structurally
  // unsafe); historical recovery, if ever wanted, is a separate explicitly-launched,
  // governor-paced job (seed-current-offers.ts).
  const PG_PAGE = 1000;
  type Stg = { raw_obs_id: number; store_id: number | null; identity_key: string; status: string; price: number | null; url: string | null; name: string; confidence: number; payload: Record<string, unknown>; observed_at?: string | null };

  // (a) newest new row per (key, store). Cursor monotonicity makes later sweeps strictly
  // newer, so plain upserts into the current state stay correct.
  const touchedSet = new Set(touchedKeys);
  const newByKeyStore = new Map<string, Stg>();
  for (const rawRow of (opts.sweepRows ?? []) as (Stg & { category?: string })[]) {
    if (rawRow.category && rawRow.category !== def.category) continue;
    if (!touchedSet.has(rawRow.identity_key)) continue;
    if (def.requireValidTier && rawRow.status !== "valid") continue;
    if (rawRow.store_id == null) continue;
    const k = `${rawRow.identity_key}|${rawRow.store_id}`;
    const prev = newByKeyStore.get(k);
    if (!prev || rawRow.raw_obs_id > prev.raw_obs_id) newByKeyStore.set(k, rawRow);
  }

  // (b) previous current state for the touched keys (small; paginated defensively —
  // ≤ keys × stores rows, i.e. a 100-key chunk tops out around a dozen hundred rows).
  const prevByKeyStore = new Map<string, Stg>();
  for (let i = 0; i < touchedKeys.length; i += 100) {
    const chunk = touchedKeys.slice(i, i + 100);
    let from = 0;
    for (;;) {
      const { data, error } = await sb.from("tps_current_offers")
        .select("raw_obs_id, store_id, identity_key, status, price, url, name, confidence, payload, observed_at")
        .eq("category", def.category).in("identity_key", chunk)
        .order("raw_obs_id", { ascending: true })
        .range(from, from + PG_PAGE - 1);
      if (error) throw new Error(`current-offers load: ${error.message}`);
      const rows = (data ?? []) as Stg[];
      for (const r of rows) {
        if (def.requireValidTier && r.status !== "valid") continue;
        if (r.store_id == null) continue;
        prevByKeyStore.set(`${r.identity_key}|${r.store_id}`, r);
      }
      if (rows.length < PG_PAGE) break;
      from += PG_PAGE;
    }
  }

  // Merge: current state = previous, overridden by this sweep's newer rows.
  const mergedByKeyStore = new Map<string, Stg>(prevByKeyStore);
  for (const [k, r] of newByKeyStore) mergedByKeyStore.set(k, r);
  const byKey = new Map<string, Stg[]>();
  for (const r of mergedByKeyStore.values()) {
    if (!byKey.has(r.identity_key)) byKey.set(r.identity_key, []);
    byKey.get(r.identity_key)!.push(r);
  }
  // Newest-first within each key so `offers[0]` (the representative payload for
  // names/attrs/image) is the freshest evidence, never the oldest.
  for (const list of byKey.values()) list.sort((a, b) => b.raw_obs_id - a.raw_obs_id);

  // ADR-096: reuse the EXISTING canonical id for any tps_identity_key already in the
  // graph. The canonical id is a hash of canonSeed(key), but the same key can already
  // live under a DIFFERENT id (older canonSeed, or a cross-category writer) — minting a
  // fresh id then violates the `canonical_products_tps_identity_key_uidx` unique index and
  // aborts the whole normalize chain (surfaced by new Almanea/Najm microwave data). By
  // targeting the existing row's id, the upsert updates it in place instead of colliding.
  const existingByKey = new Map<string, { id: string; image_url: string | null }>();
  {
    const keys = [...byKey.keys()];
    for (let i = 0; i < keys.length; i += 200) {
      const { data } = await sb.from("canonical_products").select("id, tps_identity_key, image_url").in("tps_identity_key", keys.slice(i, i + 200));
      for (const r of (data ?? []) as { id: string; tps_identity_key: string; image_url: string | null }[]) existingByKey.set(r.tps_identity_key, { id: r.id, image_url: r.image_url });
    }
  }

  const now = new Date().toISOString();
  const canonicalRows: Record<string, unknown>[] = [], normalizedRows: Record<string, unknown>[] = [], matchRows: Record<string, unknown>[] = [], priceRows: Record<string, unknown>[] = [], canonicalIds: string[] = [];
  for (const [key, all] of byKey) {
    let offers = all;
    if (def.priceBand) {
      const priced = offers.filter((o) => o.price != null).map((o) => o.price as number);
      const minP = priced.length ? Math.min(...priced) : null;
      if (minP != null) offers = offers.filter((o) => o.price == null || (o.price as number) <= minP * def.priceBand!);
    }
    const storeIds = new Set<number>(); for (const o of offers) if (o.store_id != null) storeIds.add(o.store_id);
    // Layer split: default path writes only ≥2-store (Layer 1 comparable);
    // singleStore path writes only exactly-1-store (Layer 2 resolved-single).
    if (single) { if (storeIds.size !== 1) continue; R.singleStore++; }
    else { if (storeIds.size < 2) { R.singleStore++; continue; } R.corroborated++; }

    const existing = existingByKey.get(key);
    const canonicalId = existing?.id ?? stableUuid(def.canonSeed(key)); canonicalIds.push(canonicalId);
    const rep = offers[0].payload || {};
    const { nameAr, nameEn } = def.names(key, rep);
    const parts = key.split("|");
    const isPrimary = parts[1]?.startsWith("MODEL:");
    const groupConf = single
      ? Math.min(75, Math.round(offers.reduce((a, b) => a + (b.confidence || 0), 0) / offers.length))
      : Math.min(95, Math.round(offers.reduce((a, b) => a + (b.confidence || 0), 0) / offers.length) + 5);
    // Fill-only image: prefer a freshly-observed image, else keep whatever the canonical
    // already had (never overwrite a real image with null on a run where an offer lost it).
    const observedImage = (offers.find((o) => typeof o.payload?._image === "string" && /^https?:\/\//i.test(o.payload._image as string))?.payload?._image as string | undefined) ?? null;
    const image_url = observedImage ?? existing?.image_url ?? null;
    const observedGtin = offers.find((o) => typeof o.payload?._gtin === "string")?.payload?._gtin as string | undefined;
    canonicalRows.push({
      id: canonicalId, name_ar: nameAr, name_en: nameEn, brand: parts[0],
      model_number: isPrimary ? parts[1].slice(6) : null, category: def.category, image_url,
      attributes: { ...def.attrs(key, rep), identity_key: key, identity_tier: isPrimary ? "primary" : "fallback", stores: [...storeIds], offers_count: offers.length, parser_version: def.version, source: "progressive", comparison_eligible: !single, ...(observedGtin ? { gtin: observedGtin } : {}) },
      is_active: true, tps_identity_key: key, tps_version: def.version, variant_key: key,
      identity_confidence: groupConf, data_quality_score: Math.max(50, groupConf - 10), created_at: now, data_updated_at: now,
    });
    const normById = new Map<number, string>();
    // FORWARD-ONLY (ADR-252): normalized observations, matches and price events are written
    // ONLY for THIS sweep's new rows. Prior stores' rows already got theirs in their own
    // sweeps — rewriting them every touch was the write amplification of the old design.
    const newOffers = offers.filter((o) => newByKeyStore.get(`${key}|${o.store_id}`)?.raw_obs_id === o.raw_obs_id);
    for (const o of newOffers) {
      const normId = stableUuid(def.normSeed(o.raw_obs_id)); normById.set(o.raw_obs_id, normId);
      normalizedRows.push({
        id: normId, source_table: "raw_observations", source_record_id: stableUuid(`raw_observations:${o.raw_obs_id}`),
        store_id: String(o.store_id), canonical_product_id: canonicalId, raw_name: o.name, detected_category: def.detected,
        language: "ar", brand: parts[0], model_number: isPrimary ? parts[1].slice(6) : null, color: (o.payload?.color as string) ?? null,
        identity_key: key, identity_key_status: o.status, normalized_payload: { ...(o.payload || {}), _raw_id: o.raw_obs_id, _url: o.url },
        confidence: o.confidence, missing_critical: [], ambiguity_flags: [], needs_llm: false, ignored_terms: [],
        // Same correction as the price row: the normalized observation records WHEN THE
        // OBSERVATION HAPPENED. `normalized_product_observations.observed_at` is read by the
        // UCP feed and the agent decide route as an offer-freshness signal, so processing time
        // here was the same falsely-fresh claim one layer up.
        normalizer_version: def.version, tps_version: def.version, observed_at: o.observed_at ?? now, plugin_version: def.version,
      });
    }
    for (const o of newOffers) {
      const sid = o.store_id as number;
      matchRows.push({ raw_observation_id: normById.get(o.raw_obs_id), canonical_product_id: canonicalId, match_method: "tps_identity_key", confidence: groupConf, is_verified: false, matched_at: now, identity_resolution_event_id: null });
      // THE PRICE EVENT CARRIES WHEN WE OBSERVED IT, not when we processed it (measured
      // 2026-07-31: staging averaged 6.4 days behind the scrape; stamping processing time
      // made old prices render as "observed today"). store_id travels with the event
      // (ADR-004 / migration 026) — the customer chart joins on (canonical, store_id).
      //
      // CHANGE-ONLY, AGAINST CURRENT STATE (ADR-252): the previous price for this
      // (key, store) comes from `tps_current_offers` — NOT from scanning price_history
      // (the old paginated last-price load is gone; that scan was part of the IO bill).
      // A (key, store) never seen in the current state appends its first event once;
      // change-only from then on. This sweep's row IS the store's current offer, so
      // selectCurrentOffer over history is no longer needed here.
      const prevPrice = prevByKeyStore.get(`${key}|${sid}`)?.price ?? null;
      const changed = o.price != null && !(prevPrice != null && Number(prevPrice) === Number(o.price));
      if (changed) {
        priceRows.push({ canonical_product_id: canonicalId, store_name: TPS_STORES.find((s) => s.id === sid)?.name ?? String(sid), store_id: sid, price: o.price, tps_observation_id: normById.get(o.raw_obs_id), observed_at: o.observed_at ?? now });
      }
    }
  }
  R.normalized = normalizedRows.length; R.matches = matchRows.length;
  if (!opts.dry) {
    // Persist the new HOT current state FIRST — BEFORE any layer-qualification early
    // return. A key that does not qualify for THIS pass's layer (single-store key in the
    // multi pass, or vice versa) must still have its current offers recorded, or the state
    // silently rots (caught by the ADR-252 test suite). Real runs only; idempotent. — this sweep's rows only, upsert guarded so an
    // unchanged offer re-observed within the hour does not rewrite the row (unguarded
    // ON CONFLICT DO UPDATE rewrites identical rows: dead tuples + WAL for nothing).
    const samePrice2 = (a: unknown, b: unknown) => (a == null && b == null) || (a != null && b != null && Number(a) === Number(b));
    const upserts: Record<string, unknown>[] = [];
    for (const [k, o] of newByKeyStore) {
      const prev = prevByKeyStore.get(k);
      if (prev && samePrice2(prev.price, o.price) && prev.status === o.status && prev.url === o.url
          && prev.observed_at && o.observed_at
          && new Date(o.observed_at).getTime() - new Date(prev.observed_at).getTime() < 3600_000) continue;
      upserts.push({
        category: def.category, identity_key: o.identity_key, store_id: o.store_id,
        raw_obs_id: o.raw_obs_id, status: o.status, price: o.price, url: o.url, name: o.name,
        confidence: o.confidence, payload: o.payload ?? {}, observed_at: o.observed_at ?? null,
        updated_at: now,
      });
    }
    for (let i = 0; i < upserts.length; i += 500) {
      const { error } = await sb.from("tps_current_offers").upsert(upserts.slice(i, i + 500), { onConflict: "category,identity_key,store_id" });
      if (error) throw new Error(`current-offers upsert: ${error.message}`);
    }
  }
  if (!canonicalRows.length) return R;

  // Price events are already change-only, computed against the current state above —
  // no price_history scan of any size exists in this pass anymore (ADR-252).
  const changedPrices = priceRows;
  R.prices = changedPrices.length;

  // DRY: report what WOULD be written, mutate nothing. canonicalsWritten is the intended count
  // rather than a returned one, and is labelled as such by the caller.
  if (opts.dry) { R.canonicalsWritten = canonicalRows.length; return R; }


  // WRITE IN BOUNDED SLICES (ADR-251). Pre-fix, the staging truncation accidentally kept
  // every write_ac_batch payload under ~1,000 normalized rows. Post-fix, a touched key
  // brings its FULL staging history (the self-heal), so a single RPC could carry tens of
  // thousands of rows and hit the role statement timeout — throwing away the whole batch.
  // Slices align on canonical boundaries (a canonical's rows always travel together), each
  // RPC stays far below the timeout, and every write remains the same idempotent upsert.
  const WRITE_SLICE_ROWS = 1500;
  const canonById = new Map(canonicalRows.map((c) => [c.id as string, c]));
  const groupBy = (rows: Record<string, unknown>[], field: string) => {
    const m = new Map<string, Record<string, unknown>[]>();
    for (const r of rows) { const k = r[field] as string; const arr = m.get(k) ?? []; arr.push(r); m.set(k, arr); }
    return m;
  };
  const normByCanon = groupBy(normalizedRows, "canonical_product_id");
  const matchByCanon = groupBy(matchRows, "canonical_product_id");
  const priceByCanon = groupBy(changedPrices, "canonical_product_id");

  let sIds: string[] = [], sCanon: Record<string, unknown>[] = [], sNorm: Record<string, unknown>[] = [], sMatch: Record<string, unknown>[] = [], sPrice: Record<string, unknown>[] = [];
  const flush = async () => {
    if (!sIds.length) return;
    const { data: result, error } = await sb.rpc("write_ac_batch", { p_canonical: sCanon, p_normalized: sNorm, p_matches: sMatch, p_prices: sPrice, p_canonical_ids: sIds });
    if (error) throw new Error(`write_ac_batch(${def.category}): ${error.message}`);
    R.canonicalsWritten += (result as { canonical: number }).canonical;
    sIds = []; sCanon = []; sNorm = []; sMatch = []; sPrice = [];
  };
  for (const id of canonicalIds) {
    const c = canonById.get(id);
    if (!c) continue;
    sIds.push(id); sCanon.push(c);
    sNorm.push(...(normByCanon.get(id) ?? []));
    sMatch.push(...(matchByCanon.get(id) ?? []));
    sPrice.push(...(priceByCanon.get(id) ?? []));
    if (sNorm.length >= WRITE_SLICE_ROWS) await flush();
  }
  await flush();
  return R;
}

// One bounded progressive SWEEP unit: single-pass normalize across all categories
// (≤limit obs), then corroborate each category's touched keys. Category isolation
// holds — corroboration is per-category; only the read scan is shared.
export async function runSweepUnit(sb: SupabaseClient, defs: CategoryDef[], limit = TPS_MAX_OBSERVATIONS, onlyStores?: number[], dry = false, replayFrom?: number) {
  if (limit > TPS_MAX_OBSERVATIONS) throw new Error(`limit ${limit} exceeds ${TPS_MAX_OBSERVATIONS}`);
  const n = await normalizeSweep(sb, defs, limit, onlyStores, dry, replayFrom);
  const corr: Record<string, CorroborateMetrics> = {};
  for (const def of defs) {
    const touched = [...n.byCategory[def.category].touched];
    if (touched.length) {
      // ADR-252: BOTH layers run here with the same sweep rows, so every new observation
      // gets its normalized row / price event in the hourly chain regardless of whether
      // its key is currently single-store (Layer 2) or comparable (Layer 1). The two
      // passes write disjoint key sets by construction (the layer split).
      const multi = await corroboratePass(sb, def, touched, { dry, sweepRows: n.pendingStaging });
      const singles = await corroboratePass(sb, def, touched, { dry, sweepRows: n.pendingStaging, singleStore: true });
      corr[def.category] = {
        keysConsidered: multi.keysConsidered,
        corroborated: multi.corroborated,
        singleStore: singles.singleStore,
        canonicalsWritten: multi.canonicalsWritten + singles.canonicalsWritten,
        normalized: multi.normalized + singles.normalized,
        matches: multi.matches + singles.matches,
        prices: multi.prices + singles.prices,
      };
    }
  }
  return { normalize: n, corroborate: corr };
}
