// scripts/tps-matcher/tv-matcher-v1-dry.ts
// Category-specific TV matcher (TV Identity Contract v1). Importable (runTvBatch)
// + CLI. Uses tvPlugin ONLY. Balanced multi-store fetch (Jarir + Extra + Amazon +
// Almanea) by canonical store_id, hard-capped so total <= limit (<=500). Writes
// ONLY >=2-store-corroborated candidates via the atomic category-agnostic
// write_ac_batch RPC with category='tv'. Single-store TVs and parser-invalid rows
// are never written. Dry-run-first; idempotent; rollback via canonical_ids delete.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { tvPlugin, normalize as tvNormalize } from "../tps-plugins/tv";
import {
  type TpsBatchOptions, type TpsBatchResult,
  assertBatchInvariants, assertFingerprint, perStoreLimit,
} from "../tps-core/tps-batch";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const TV_STORES = [{ id: 1, name: "جرير" }, { id: 4, name: "اكسترا" }, { id: 2, name: "أمازون" }, { id: 5, name: "المنيع" }];
const TV_FILTER = ["raw_name.ilike.%tv%", "raw_name.ilike.%تلفزيون%", "raw_name.ilike.%television%", "raw_name.ilike.%smart tv%", "raw_name.ilike.%شاشة%"].join(",");

interface RawRow { id: number; store_id: number | null; store_name: string | null; raw_name: string | null; payload: Record<string, unknown> | null; }
const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
function adaptRow(row: RawRow) {
  const p = row.payload ?? {};
  const nameAr = asString(p.nameAr) ?? asString(p.name_ar) ?? asString(p.name) ?? asString(row.raw_name) ?? "";
  const nameEn = asString(p.nameEn) ?? asString(p.name_en) ?? asString(p.title) ?? "";
  const brand = asString(p.brandEn) ?? asString(p.brand) ?? asString(p.brandAr) ?? null;
  const url = asString(p.urlAr) ?? asString(p.urlEn) ?? asString(p.url) ?? asString(p.product_url) ?? asString(p.link) ?? null;
  return { nameAr, nameEn, brand, url, payload: p };
}
function extractPrice(p: Record<string, unknown>): number | null {
  for (const c of [p.current_price, p.sellingPrice, p.price, p.wasPrice, p.original_price]) {
    const n = typeof c === "number" ? c : Number(asString(c));
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}
function stableUuid(seed: string): string {
  const h = createHash("sha256").update(seed).digest("hex");
  return [h.slice(0, 8), h.slice(8, 12), "4" + h.slice(13, 16), ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20), h.slice(20, 32)].join("-");
}

const BRAND_AR: Record<string, string> = { samsung: "سامسونج", lg: "إل جي", sony: "سوني", tcl: "تي سي إل", hisense: "هايسنس", toshiba: "توشيبا", nikai: "نيكاي", panasonic: "باناسونيك", philips: "فيليبس", dansat: "دان سات", skyworth: "سكاي ورث", haier: "هاير", vision: "فيجن" };
const RES_EN: Record<string, string> = { "8k": "8K", "4k": "4K UHD", fhd: "Full HD", hd: "HD" };
const PANEL_EN: Record<string, string> = { neo_qled: "Neo QLED", oled: "OLED", qned: "QNED", nanocell: "NanoCell", mini_led: "Mini LED", qled: "QLED", crystal: "Crystal UHD", led: "LED" };
function buildNames(key: string): { nameAr: string; nameEn: string } {
  const parts = key.split("|");
  const brand = parts[0];
  const bAr = BRAND_AR[brand] ?? brand;
  const bEn = brand.charAt(0).toUpperCase() + brand.slice(1);
  if (parts[1]?.startsWith("MODEL:")) {
    const model = parts[1].slice(6);
    return { nameAr: `تلفزيون ${bAr} ${model}`.trim(), nameEn: `${bEn} ${model} TV`.trim() };
  }
  const [, size, res, panel, refresh] = parts;
  const resEn = res === "NO_RES" ? "" : ` ${RES_EN[res] ?? res}`;
  const panEn = panel === "NO_PANEL" ? "" : ` ${PANEL_EN[panel] ?? panel}`;
  const hzEn = refresh && refresh !== "NO_HZ" ? ` ${refresh}Hz` : "";
  const nameEn = `${bEn} ${size}" ${resEn}${panEn}${hzEn} Smart TV`.replace(/\s+/g, " ").trim();
  const nameAr = `تلفزيون ${bAr} ${size} بوصة${resEn}${panEn}${hzEn} ذكي`.replace(/\s+/g, " ").trim();
  return { nameAr, nameEn };
}

export async function runTvBatch(opts: TpsBatchOptions): Promise<TpsBatchResult> {
  const t0 = Date.now();
  const R: TpsBatchResult = {
    category: "tv", requestedLimit: opts.limit, effectiveHardLimit: opts.limit,
    fetched: 0, considered: 0, parserFailures: 0, lowConfidence: 0, conflicts: 0,
    proposedCanonicals: 0, writtenCanonicals: 0, normalized: 0, matches: 0, prices: 0,
    statusUpdates: 0, skipped: 0, durationMs: 0, success: false, dryRun: opts.dryRun, error: null,
  };
  try {
    if (opts.category !== "tv") throw new Error("category isolation: runTvBatch only handles tv");
    assertBatchInvariants(opts);
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("no supabase env");
    assertFingerprint(SUPABASE_URL, opts.expectedFingerprint);
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

    const perStore = perStoreLimit(opts.limit, TV_STORES.length);
    const rows: RawRow[] = [];
    for (const s of TV_STORES) {
      const { data, error } = await supabase.from("raw_observations").select("id, store_id, store_name, raw_name, payload").eq("store_id", s.id).or(TV_FILTER).order("id", { ascending: true }).limit(perStore);
      if (error) throw new Error(`fetch store ${s.id}: ${error.message}`);
      rows.push(...((data ?? []) as RawRow[]));
    }
    R.fetched = rows.length;
    if (R.fetched > opts.limit) throw new Error(`bound violation: fetched ${R.fetched} > limit ${opts.limit}`);

    const offers: { obsId: number; storeId: number | null; store: string; key: string; status: string; price: number | null; name: string; url: string | null; confidence: number; payload: Record<string, unknown> }[] = [];
    for (const row of rows) {
      const { nameAr, nameEn, brand, url, payload } = adaptRow(row);
      if (!tvPlugin.detect(nameAr, nameEn)) continue;
      R.considered++;
      const norm = tvNormalize(nameAr, nameEn, brand, payload);
      const identity = tvPlugin.buildIdentityKey(brand, norm.payload, { model_number: norm.model_number });
      if (identity.status === "invalid") { R.parserFailures++; continue; }
      if (identity.status === "low_confidence_candidate") R.lowConfidence++;
      if (!identity.key) continue;
      const conf = tvPlugin.scoreConfidence(brand, norm.payload, norm.model_number, norm.ambiguity_flags);
      offers.push({ obsId: row.id, storeId: row.store_id, store: row.store_name ?? "?", key: identity.key, status: identity.status, price: extractPrice(payload), name: (nameEn || nameAr), url, confidence: conf.confidence, payload: norm.payload });
    }

    // Only VALID-tier offers (full brand|size|res|panel|refresh) form canonicals.
    // low_confidence keys (NO_HZ / NO_PANEL) are over-merge-prone → never written.
    const groups = new Map<string, { offers: typeof offers }>();
    for (const o of offers) { if (o.status !== "valid") continue; if (!groups.has(o.key)) groups.set(o.key, { offers: [] }); groups.get(o.key)!.offers.push(o); }
    // Price-band precision guard: same-model TVs don't differ ~1.5x+ in price
    // across stores. Anchor on the group's min priced offer and drop priced
    // outliers (> PRICE_BAND x min) — they are sibling models the fallback key
    // can't yet separate (e.g. Hisense 65 QLED 144Hz 2449 vs 4599). Null-priced
    // offers are kept (can't judge). Re-check >=2-store AFTER pruning.
    const PRICE_BAND = 1.5;
    const safe: [string, { storeIds: Set<number>; offers: typeof offers }][] = [];
    for (const [key, g] of groups) {
      const priced = g.offers.filter((o) => o.price != null).map((o) => o.price as number);
      const minP = priced.length ? Math.min(...priced) : null;
      const kept = minP == null ? g.offers : g.offers.filter((o) => o.price == null || (o.price as number) <= minP * PRICE_BAND);
      const storeIds = new Set<number>(); for (const o of kept) if (o.storeId != null) storeIds.add(o.storeId);
      if (storeIds.size >= 2) safe.push([key, { storeIds, offers: kept }]);
    }
    R.skipped = groups.size - safe.length;
    R.proposedCanonicals = safe.length;

    const now = new Date().toISOString();
    const canonicalRows: Record<string, unknown>[] = [], normalizedRows: Record<string, unknown>[] = [], matchRows: Record<string, unknown>[] = [], priceRows: Record<string, unknown>[] = [], canonicalIds: string[] = [];
    const processedObsIds = new Set<number>();
    for (const [key, g] of safe) {
      const canonicalId = stableUuid(`canonical:tv:${key}`); canonicalIds.push(canonicalId);
      const { nameAr, nameEn } = buildNames(key);
      const parts = key.split("|");
      const isPrimary = parts[1]?.startsWith("MODEL:");
      const groupConf = Math.min(95, Math.round(g.offers.reduce((a, b) => a + b.confidence, 0) / g.offers.length) + 5);
      canonicalRows.push({
        id: canonicalId, name_ar: nameAr, name_en: nameEn, brand: parts[0],
        model_number: isPrimary ? parts[1].slice(6) : null, category: "tv", image_url: null,
        attributes: {
          screen_size: isPrimary ? null : Number(parts[1]), resolution: isPrimary ? null : (parts[2] === "NO_RES" ? null : parts[2]),
          panel: isPrimary ? null : (parts[3] === "NO_PANEL" ? null : parts[3]),
          refresh_rate: isPrimary || !parts[4] || parts[4] === "NO_HZ" ? null : Number(parts[4]), identity_key: key,
          identity_tier: isPrimary ? "primary" : "fallback", stores: [...g.storeIds], offers_count: g.offers.length, parser_version: "tv-v1",
        },
        is_active: true, tps_identity_key: key, tps_version: "tv-v1", variant_key: key,
        identity_confidence: groupConf, data_quality_score: Math.max(60, groupConf - 10), created_at: now, data_updated_at: now,
      });
      for (const o of g.offers) {
        const normId = stableUuid(`norm:tv:raw_observations:${o.obsId}`);
        (o as { _normId?: string })._normId = normId; processedObsIds.add(o.obsId);
        normalizedRows.push({
          id: normId, source_table: "raw_observations", source_record_id: stableUuid(`raw_observations:${o.obsId}`),
          store_id: String(o.storeId), canonical_product_id: canonicalId, raw_name: o.name, detected_category: "tv",
          language: "ar", brand: parts[0], model_number: isPrimary ? parts[1].slice(6) : null, color: (o.payload.color as string) ?? null,
          identity_key: key, identity_key_status: o.status,
          normalized_payload: { ...(o.payload || {}), _raw_id: o.obsId, _url: o.url },
          confidence: o.confidence, missing_critical: [], ambiguity_flags: [], needs_llm: false, ignored_terms: [],
          normalizer_version: "tv-v1", tps_version: "tv-v1", observed_at: now, plugin_version: "tv-v1",
        });
      }
      for (const sid of g.storeIds) {
        const so = g.offers.filter((o) => o.storeId === sid);
        const priced = so.filter((o) => o.price !== null);
        const r = (priced.length ? priced.reduce((a, b) => (a.price! <= b.price! ? a : b)) : so[0]) as { _normId?: string; store: string; price: number | null };
        matchRows.push({ raw_observation_id: r._normId, canonical_product_id: canonicalId, match_method: "tps_identity_key", confidence: groupConf, is_verified: false, matched_at: now, identity_resolution_event_id: null });
        if (priced.length) priceRows.push({ canonical_product_id: canonicalId, store_name: r.store, price: r.price, tps_observation_id: r._normId, observed_at: now });
      }
    }
    R.normalized = normalizedRows.length; R.matches = matchRows.length;

    const lastPrice = new Map<string, number>();
    if (canonicalIds.length) {
      const { data: hist } = await supabase.from("price_history").select("canonical_product_id, store_name, price, observed_at").in("canonical_product_id", canonicalIds).order("observed_at", { ascending: false });
      for (const h of hist ?? []) { const k = `${h.canonical_product_id}|${h.store_name}`; if (!lastPrice.has(k)) lastPrice.set(k, Number(h.price)); }
    }
    const changedPrices = priceRows.filter((pr) => { const last = lastPrice.get(`${pr.canonical_product_id}|${pr.store_name}`); return last === undefined || last !== Number(pr.price); });
    R.prices = changedPrices.length;

    if (opts.dumpIdsPath) {
      require("fs").writeFileSync(opts.dumpIdsPath, JSON.stringify({ canonicalIds, normalizedIds: normalizedRows.map((n) => n.id), processedObsIds: [...processedObsIds], keys: safe.map(([k, g]) => ({ key: k, stores: [...g.storeIds], offers: g.offers.length })) }, null, 2));
    }

    if (opts.dryRun) { R.success = true; R.durationMs = Date.now() - t0; return R; }
    if (canonicalRows.length === 0) { R.success = true; R.durationMs = Date.now() - t0; return R; }

    const { data: result, error } = await supabase.rpc("write_ac_batch", { p_canonical: canonicalRows, p_normalized: normalizedRows, p_matches: matchRows, p_prices: changedPrices, p_canonical_ids: canonicalIds });
    if (error) throw new Error(`write_ac_batch(tv): ${error.message}`);
    const w = result as { canonical: number; normalized: number; matches: number; prices: number };
    R.writtenCanonicals = w.canonical; R.normalized = w.normalized; R.matches = w.matches; R.prices = w.prices;
    const obsIds = [...processedObsIds];
    for (let i = 0; i < obsIds.length; i += 200) {
      const { error: e } = await supabase.from("raw_observations").update({ processing_status: "done" }).in("id", obsIds.slice(i, i + 200));
      if (e) { R.error = `status update: ${e.message}`; break; }
      R.statusUpdates += Math.min(200, obsIds.length - i);
    }
    R.success = true; R.durationMs = Date.now() - t0; return R;
  } catch (e) {
    R.error = e instanceof Error ? e.message : String(e); R.success = false; R.durationMs = Date.now() - t0; return R;
  }
}

if (require.main === module) {
  runTvBatch({
    category: "tv",
    dryRun: process.env.DRY_RUN !== "false",
    limit: Number(process.env.TV_TOTAL_LIMIT || 500),
    expectedFingerprint: "vyceqrzttspyycdpojtn",
    source: "manual",
    dumpIdsPath: process.env.DUMP_IDS,
  }).then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.success ? 0 : 1); })
    .catch((e) => { console.error(e); process.exit(1); });
}
