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
  if (dry) {
    m.pendingStaging = stagingRows;
  } else {
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
  /** DRY-RUN ONLY. Staging rows computed in-memory by this run's sweep, merged with persisted
   *  staging so the dry pass sees its own work. Deduped by (category, raw_obs_id) — the same
   *  key the real staging upsert uses — so an observation already persisted is never counted
   *  twice. */
  extraStaging?: Record<string, unknown>[];
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

  // Load all staging rows for the touched keys (across all slices ever normalized).
  type Stg = { raw_obs_id: number; store_id: number | null; identity_key: string; status: string; price: number | null; url: string | null; name: string; confidence: number; payload: Record<string, unknown>; observed_at?: string | null };
  const byKey = new Map<string, Stg[]>();
  for (let i = 0; i < touchedKeys.length; i += 100) {
    const chunk = touchedKeys.slice(i, i + 100);
    const { data, error } = await sb.from("tps_identity_staging").select("raw_obs_id, store_id, identity_key, status, price, url, name, confidence, payload, observed_at").eq("category", def.category).in("identity_key", chunk);
    if (error) throw new Error(`staging load: ${error.message}`);
    for (const r of (data ?? []) as Stg[]) {
      if (def.requireValidTier && r.status !== "valid") continue;
      if (!byKey.has(r.identity_key)) byKey.set(r.identity_key, []);
      byKey.get(r.identity_key)!.push(r);
    }
  }

  // DRY-RUN: fold in the staging this run computed but did not persist. Deduped on
  // (category, raw_obs_id) — the real upsert's conflict target — so a row that is already in
  // the table is not double-counted, and the dry metrics match what a real run would produce.
  if (opts.extraStaging?.length) {
    const seen = new Set<number>();
    for (const list of byKey.values()) for (const r of list) seen.add(r.raw_obs_id);
    const touched = new Set(touchedKeys);
    for (const raw of opts.extraStaging as unknown as (Stg & { category?: string })[]) {
      if (raw.category && raw.category !== def.category) continue;
      if (!touched.has(raw.identity_key)) continue;
      if (seen.has(raw.raw_obs_id)) continue;
      if (def.requireValidTier && raw.status !== "valid") continue;
      seen.add(raw.raw_obs_id);
      if (!byKey.has(raw.identity_key)) byKey.set(raw.identity_key, []);
      byKey.get(raw.identity_key)!.push(raw);
    }
  }

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
    for (const o of offers) {
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
    for (const sid of storeIds) {
      const so = offers.filter((o) => o.store_id === sid);
      const priced = so.filter((o) => o.price !== null);
      // See selectCurrentOffer's doc comment — P0 price-truth incident, 2026-08-07.
      const r = selectCurrentOffer(priced, so[0]);
      matchRows.push({ raw_observation_id: normById.get(r.raw_obs_id), canonical_product_id: canonicalId, match_method: "tps_identity_key", confidence: groupConf, is_verified: false, matched_at: now, identity_resolution_event_id: null });
      // THE PRICE EVENT CARRIES WHEN WE OBSERVED IT, not when we processed it.
      //
      // This was `observed_at: now`. `price_history.observed_at` is the column the customer
      // reads — the compare page renders «رصدناه قبل X يومًا» from it
      // (get-comparison.ts:131,151) and the Trust Engine's freshness signal is its max
      // (build-tps-projection.ts:167). Stamping processing time made a price we saw days ago
      // render as "observed today".
      //
      // Not hypothetical: measured 2026-07-31, staging runs on average 6.4 DAYS behind the
      // scrape (296,339 rows; 71.9% >24h; max 43.3 days). Published freshness has therefore
      // been UNDERSTATING true staleness by about that much — for the healthy scraper path,
      // not only for the discovery backlog.
      //
      // Falls back to `now` only if the staging row predates this change and has no
      // timestamp; a NULL must never silently become "just now".
      // store_id travels with the price event (ADR-004 / migration 026): the
      // customer chart joins price_history on (canonical_product_id, store_id),
      // and rows stamped with only the display name were invisible to it.
      if (priced.length) priceRows.push({ canonical_product_id: canonicalId, store_name: TPS_STORES.find((s) => s.id === sid)?.name ?? String(sid), store_id: sid, price: r.price, tps_observation_id: normById.get(r.raw_obs_id), observed_at: r.observed_at ?? now });
    }
  }
  R.normalized = normalizedRows.length; R.matches = matchRows.length;
  if (!canonicalRows.length) return R;

  // Append-only price history: only changed prices.
  const lastPrice = new Map<string, number>();
  const { data: hist } = await sb.from("price_history").select("canonical_product_id, store_name, price, observed_at").in("canonical_product_id", canonicalIds).order("observed_at", { ascending: false });
  for (const h of hist ?? []) { const k = `${h.canonical_product_id}|${h.store_name}`; if (!lastPrice.has(k)) lastPrice.set(k, Number(h.price)); }
  const changedPrices = priceRows.filter((pr) => { const l = lastPrice.get(`${pr.canonical_product_id}|${pr.store_name}`); return l === undefined || l !== Number(pr.price); });
  R.prices = changedPrices.length;

  // DRY: report what WOULD be written, mutate nothing. canonicalsWritten is the intended count
  // rather than a returned one, and is labelled as such by the caller.
  if (opts.dry) { R.canonicalsWritten = canonicalRows.length; return R; }

  const { data: result, error } = await sb.rpc("write_ac_batch", { p_canonical: canonicalRows, p_normalized: normalizedRows, p_matches: matchRows, p_prices: changedPrices, p_canonical_ids: canonicalIds });
  if (error) throw new Error(`write_ac_batch(${def.category}): ${error.message}`);
  const w = result as { canonical: number };
  R.canonicalsWritten = w.canonical;
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
    if (touched.length) corr[def.category] = await corroboratePass(sb, def, touched, { dry, extraStaging: dry ? n.pendingStaging : undefined });
  }
  return { normalize: n, corroborate: corr };
}
