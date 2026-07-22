// scripts/tps-core/progressive-engine.ts
// Safe progressive TPS batching. Separates NORMALIZATION (progressive, durable
// per-(category,store) cursor, ≤500 observations/run) from CORROBORATION (global
// grouping by identity_key over the accumulated `tps_identity_staging`, so an
// early-slice product corroborates with a late-slice match). All authoritative
// writes still go through the verified atomic write_ac_batch; canonical/normalized
// ids reuse the original matcher seeds (no duplicates). Idempotent; resumable.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { pickBestUrl } from "./url-util";
import { CATEGORY_DEFS, TPS_STORES, type CategoryDef } from "./category-registry";
import { TPS_MAX_OBSERVATIONS } from "./tps-batch";

function stableUuid(seed: string): string {
  const h = createHash("sha256").update(seed).digest("hex");
  return [h.slice(0, 8), h.slice(8, 12), "4" + h.slice(13, 16), ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20), h.slice(20, 32)].join("-");
}
const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
function adaptRow(p: Record<string, unknown>, rawName: string | null) {
  const nameAr = asString(p.nameAr) ?? asString(p.name_ar) ?? asString(p.name) ?? asString(rawName) ?? "";
  const nameEn = asString(p.nameEn) ?? asString(p.name_en) ?? asString(p.title) ?? "";
  const brand = asString(p.brandEn) ?? asString(p.brand) ?? asString(p.brandAr) ?? null;
  return { nameAr, nameEn, brand, url: pickBestUrl(p) };
}
function extractPrice(p: Record<string, unknown>): number | null {
  for (const c of [p.current_price, p.sellingPrice, p.price, p.wasPrice, p.original_price]) {
    const n = typeof c === "number" ? c : Number(asString(c));
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}

export interface SweepMetrics { fetched: number; staged: number; saturated: boolean; byCategory: Record<string, { detected: number; valid: number; lowConfidence: number; invalid: number; touched: Set<string> }>; }

const GLOBAL = "_all_"; // cursor category for the single-pass scan

// ── Single-pass NORMALIZE across ALL categories. One id-indexed scan per store
//    (no ILIKE → no slow filter, no per-category re-scan). Each row is classified
//    by every plugin's detect(); matches are staged into their category. Global
//    per-store cursor. ≤limit observations/run. ──
export async function normalizeSweep(sb: SupabaseClient, defs: CategoryDef[], limit: number): Promise<SweepMetrics> {
  const perStore = Math.max(1, Math.floor(limit / TPS_STORES.length));
  const m: SweepMetrics = { fetched: 0, staged: 0, saturated: false, byCategory: {} };
  for (const d of defs) m.byCategory[d.category] = { detected: 0, valid: 0, lowConfidence: 0, invalid: 0, touched: new Set() };
  const stagingRows: Record<string, unknown>[] = [];
  for (const s of TPS_STORES) {
    const { data: cur } = await sb.from("tps_progress_cursors").select("last_raw_id").eq("category", GLOBAL).eq("store_id", s.id).maybeSingle();
    const last = Number(cur?.last_raw_id ?? 0);
    const { data, error } = await sb.from("raw_observations").select("id, store_id, raw_name, payload").eq("store_id", s.id).gt("id", last).order("id", { ascending: true }).limit(perStore);
    if (error) throw new Error(`fetch store ${s.id}: ${error.message}`);
    const rows = (data ?? []) as { id: number; store_id: number | null; raw_name: string | null; payload: Record<string, unknown> | null }[];
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
        stagingRows.push({
          category: def.category, raw_obs_id: row.id, store_id: row.store_id, identity_key: identity.key,
          status: identity.status, price: extractPrice(p), url, name: (nameEn || nameAr).slice(0, 300),
          confidence: conf.confidence, detected: true, payload: norm.payload, observed_at: new Date().toISOString(),
        });
      }
    }
    const { error: ce } = await sb.from("tps_progress_cursors").upsert({ category: GLOBAL, store_id: s.id, last_raw_id: maxId, updated_at: new Date().toISOString() }, { onConflict: "category,store_id" });
    if (ce) throw new Error(`cursor upsert store ${s.id}: ${ce.message}`);
  }
  for (let i = 0; i < stagingRows.length; i += 500) {
    const { error } = await sb.from("tps_identity_staging").upsert(stagingRows.slice(i, i + 500), { onConflict: "category,raw_obs_id" });
    if (error) throw new Error(`staging upsert: ${error.message}`);
  }
  m.staged = stagingRows.length;
  m.saturated = m.fetched === 0;
  return m;
}

export interface CorroborateMetrics { keysConsidered: number; corroborated: number; singleStore: number; canonicalsWritten: number; normalized: number; matches: number; prices: number; }

// ── Corroboration pass: for the touched keys, group ALL accumulated staging by
//    identity_key; ≥2-store (+ optional price-band) → upsert canonical via
//    write_ac_batch. Idempotent; only touched keys are (re)written per run. ──
export async function corroboratePass(sb: SupabaseClient, def: CategoryDef, touchedKeys: string[]): Promise<CorroborateMetrics> {
  const R: CorroborateMetrics = { keysConsidered: touchedKeys.length, corroborated: 0, singleStore: 0, canonicalsWritten: 0, normalized: 0, matches: 0, prices: 0 };
  if (!touchedKeys.length) return R;

  // Load all staging rows for the touched keys (across all slices ever normalized).
  type Stg = { raw_obs_id: number; store_id: number | null; identity_key: string; status: string; price: number | null; url: string | null; name: string; confidence: number; payload: Record<string, unknown> };
  const byKey = new Map<string, Stg[]>();
  for (let i = 0; i < touchedKeys.length; i += 100) {
    const chunk = touchedKeys.slice(i, i + 100);
    const { data, error } = await sb.from("tps_identity_staging").select("raw_obs_id, store_id, identity_key, status, price, url, name, confidence, payload").eq("category", def.category).in("identity_key", chunk);
    if (error) throw new Error(`staging load: ${error.message}`);
    for (const r of (data ?? []) as Stg[]) {
      if (def.requireValidTier && r.status !== "valid") continue;
      if (!byKey.has(r.identity_key)) byKey.set(r.identity_key, []);
      byKey.get(r.identity_key)!.push(r);
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
    if (storeIds.size < 2) { R.singleStore++; continue; }
    R.corroborated++;

    const canonicalId = stableUuid(def.canonSeed(key)); canonicalIds.push(canonicalId);
    const rep = offers[0].payload || {};
    const { nameAr, nameEn } = def.names(key, rep);
    const parts = key.split("|");
    const isPrimary = parts[1]?.startsWith("MODEL:");
    const groupConf = Math.min(95, Math.round(offers.reduce((a, b) => a + (b.confidence || 0), 0) / offers.length) + 5);
    canonicalRows.push({
      id: canonicalId, name_ar: nameAr, name_en: nameEn, brand: parts[0],
      model_number: isPrimary ? parts[1].slice(6) : null, category: def.category, image_url: null,
      attributes: { ...def.attrs(key, rep), identity_key: key, identity_tier: isPrimary ? "primary" : "fallback", stores: [...storeIds], offers_count: offers.length, parser_version: def.version, source: "progressive" },
      is_active: true, tps_identity_key: key, tps_version: def.version, variant_key: key,
      identity_confidence: groupConf, data_quality_score: Math.max(60, groupConf - 10), created_at: now, data_updated_at: now,
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
        normalizer_version: def.version, tps_version: def.version, observed_at: now, plugin_version: def.version,
      });
    }
    for (const sid of storeIds) {
      const so = offers.filter((o) => o.store_id === sid);
      const priced = so.filter((o) => o.price !== null);
      const r = (priced.length ? priced.reduce((a, b) => (a.price! <= b.price! ? a : b)) : so[0]);
      matchRows.push({ raw_observation_id: normById.get(r.raw_obs_id), canonical_product_id: canonicalId, match_method: "tps_identity_key", confidence: groupConf, is_verified: false, matched_at: now, identity_resolution_event_id: null });
      if (priced.length) priceRows.push({ canonical_product_id: canonicalId, store_name: TPS_STORES.find((s) => s.id === sid)?.name ?? String(sid), price: r.price, tps_observation_id: normById.get(r.raw_obs_id), observed_at: now });
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

  const { data: result, error } = await sb.rpc("write_ac_batch", { p_canonical: canonicalRows, p_normalized: normalizedRows, p_matches: matchRows, p_prices: changedPrices, p_canonical_ids: canonicalIds });
  if (error) throw new Error(`write_ac_batch(${def.category}): ${error.message}`);
  const w = result as { canonical: number };
  R.canonicalsWritten = w.canonical;
  return R;
}

// One bounded progressive SWEEP unit: single-pass normalize across all categories
// (≤limit obs), then corroborate each category's touched keys. Category isolation
// holds — corroboration is per-category; only the read scan is shared.
export async function runSweepUnit(sb: SupabaseClient, defs: CategoryDef[], limit = TPS_MAX_OBSERVATIONS) {
  if (limit > TPS_MAX_OBSERVATIONS) throw new Error(`limit ${limit} exceeds ${TPS_MAX_OBSERVATIONS}`);
  const n = await normalizeSweep(sb, defs, limit);
  const corr: Record<string, CorroborateMetrics> = {};
  for (const def of defs) {
    const touched = [...n.byCategory[def.category].touched];
    if (touched.length) corr[def.category] = await corroboratePass(sb, def, touched);
  }
  return { normalize: n, corroborate: corr };
}
