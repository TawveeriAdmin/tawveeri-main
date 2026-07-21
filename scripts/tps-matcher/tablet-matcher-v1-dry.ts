// scripts/tps-matcher/tablet-matcher-v1-dry.ts
// Category-specific TABLET matcher (Tablet Identity Contract v1). Importable
// (runTabletBatch) + CLI. Uses tabletPlugin ONLY. Balanced multi-store fetch
// (Jarir + Extra + Amazon + Almanea), hard-capped so total <= limit (<=500).
// Writes ONLY >=2-store-corroborated, VALID-tier candidates via the atomic
// category-agnostic write_ac_batch RPC with category='tablet'. Price-band guard
// strips sibling outliers. Dry-run-first; idempotent; rollback via canonical_ids.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { pickBestUrl } from "../tps-core/url-util";
import { tabletPlugin, normalize as tabletNormalize } from "../tps-plugins/tablet";
import {
  type TpsBatchOptions, type TpsBatchResult,
  assertBatchInvariants, assertFingerprint, perStoreLimit,
} from "../tps-core/tps-batch";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const TABLET_STORES = [{ id: 1, name: "جرير" }, { id: 4, name: "اكسترا" }, { id: 2, name: "أمازون" }, { id: 5, name: "المنيع" }];
const TABLET_FILTER = ["raw_name.ilike.%tablet%", "raw_name.ilike.%تابلت%", "raw_name.ilike.%ipad%", "raw_name.ilike.%ايباد%", "raw_name.ilike.%galaxy tab%", "raw_name.ilike.%جالكسي تاب%", "raw_name.ilike.%matepad%"].join(",");

interface RawRow { id: number; store_id: number | null; store_name: string | null; raw_name: string | null; payload: Record<string, unknown> | null; }
const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
function adaptRow(row: RawRow) {
  const p = row.payload ?? {};
  const nameAr = asString(p.nameAr) ?? asString(p.name_ar) ?? asString(p.name) ?? asString(row.raw_name) ?? "";
  const nameEn = asString(p.nameEn) ?? asString(p.name_en) ?? asString(p.title) ?? "";
  const brand = asString(p.brandEn) ?? asString(p.brand) ?? asString(p.brandAr) ?? null;
  const url = pickBestUrl(p);
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
const BRAND_AR: Record<string, string> = { apple: "ابل", samsung: "سامسونج", huawei: "هواوي", lenovo: "لينوفو", honor: "هونر", xiaomi: "شاومي", nokia: "نوكيا" };
const CONN_EN: Record<string, string> = { wifi: "Wi-Fi", "5g": "5G", "4g": "4G/LTE", cellular: "Cellular" };
function buildNames(key: string): { nameAr: string; nameEn: string } {
  const parts = key.split("|");
  const brand = parts[0];
  const bAr = BRAND_AR[brand] ?? brand;
  const bEn = brand.charAt(0).toUpperCase() + brand.slice(1);
  if (parts[1]?.startsWith("MODEL:")) {
    const model = parts[1].slice(6);
    return { nameAr: `تابلت ${bAr} ${model}`.trim(), nameEn: `${bEn} ${model} Tablet`.trim() };
  }
  const [, line, gen, storage, conn, size] = parts;
  const g = gen && gen !== "NO_GEN" ? ` ${gen.toUpperCase()}` : "";
  const sz = size && size !== "NO_SIZE" ? ` ${size}"` : "";
  const c = conn && conn !== "NO_CONN" ? ` ${CONN_EN[conn] ?? conn}` : "";
  const sto = storage ? (Number(storage) >= 1024 ? `${Number(storage) / 1024}TB` : `${storage}GB`) : "";
  const lineTitle = line.replace(/\b\w/g, (m) => m.toUpperCase());
  const nameEn = `${bEn} ${lineTitle}${g}${sz} ${sto}${c}`.replace(/\s+/g, " ").trim();
  const nameAr = `تابلت ${bAr} ${lineTitle}${g}${sz} ${sto}${c}`.replace(/\s+/g, " ").trim();
  return { nameAr, nameEn };
}

export async function runTabletBatch(opts: TpsBatchOptions): Promise<TpsBatchResult> {
  const t0 = Date.now();
  const R: TpsBatchResult = {
    category: "tablet", requestedLimit: opts.limit, effectiveHardLimit: opts.limit,
    fetched: 0, considered: 0, parserFailures: 0, lowConfidence: 0, conflicts: 0,
    proposedCanonicals: 0, writtenCanonicals: 0, normalized: 0, matches: 0, prices: 0,
    statusUpdates: 0, skipped: 0, durationMs: 0, success: false, dryRun: opts.dryRun, error: null,
  };
  try {
    if (opts.category !== "tablet") throw new Error("category isolation: runTabletBatch only handles tablet");
    assertBatchInvariants(opts);
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("no supabase env");
    assertFingerprint(SUPABASE_URL, opts.expectedFingerprint);
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

    const perStore = perStoreLimit(opts.limit, TABLET_STORES.length);
    const rows: RawRow[] = [];
    for (const s of TABLET_STORES) {
      const { data, error } = await supabase.from("raw_observations").select("id, store_id, store_name, raw_name, payload").eq("store_id", s.id).or(TABLET_FILTER).order("id", { ascending: true }).limit(perStore);
      if (error) throw new Error(`fetch store ${s.id}: ${error.message}`);
      rows.push(...((data ?? []) as RawRow[]));
    }
    R.fetched = rows.length;
    if (R.fetched > opts.limit) throw new Error(`bound violation: fetched ${R.fetched} > limit ${opts.limit}`);

    const offers: { obsId: number; storeId: number | null; store: string; key: string; status: string; price: number | null; name: string; url: string | null; confidence: number; payload: Record<string, unknown> }[] = [];
    for (const row of rows) {
      const { nameAr, nameEn, brand, url, payload } = adaptRow(row);
      if (!tabletPlugin.detect(nameAr, nameEn)) continue;
      R.considered++;
      const norm = tabletNormalize(nameAr, nameEn, brand, payload);
      const identity = tabletPlugin.buildIdentityKey(brand, norm.payload, { model_number: norm.model_number });
      if (identity.status === "invalid") { R.parserFailures++; continue; }
      if (identity.status === "low_confidence_candidate") R.lowConfidence++;
      if (!identity.key) continue;
      const conf = tabletPlugin.scoreConfidence(brand, norm.payload, norm.model_number, norm.ambiguity_flags);
      offers.push({ obsId: row.id, storeId: row.store_id, store: row.store_name ?? "?", key: identity.key, status: identity.status, price: extractPrice(payload), name: (nameEn || nameAr), url, confidence: conf.confidence, payload: norm.payload });
    }

    // Only VALID-tier offers (full brand|line|storage|connectivity) form canonicals.
    const groups = new Map<string, { offers: typeof offers }>();
    for (const o of offers) { if (o.status !== "valid") continue; if (!groups.has(o.key)) groups.set(o.key, { offers: [] }); groups.get(o.key)!.offers.push(o); }
    // Price-band precision guard (same as TV): drop priced outliers > 1.5x group
    // min, then re-check >=2-store. Strips sibling models the fallback can't split.
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
      const canonicalId = stableUuid(`canonical:tablet:${key}`); canonicalIds.push(canonicalId);
      const { nameAr, nameEn } = buildNames(key);
      const parts = key.split("|");
      const isPrimary = parts[1]?.startsWith("MODEL:");
      const groupConf = Math.min(95, Math.round(g.offers.reduce((a, b) => a + b.confidence, 0) / g.offers.length) + 5);
      canonicalRows.push({
        id: canonicalId, name_ar: nameAr, name_en: nameEn, brand: parts[0],
        model_number: isPrimary ? parts[1].slice(6) : null, category: "tablet", image_url: null,
        attributes: {
          line: isPrimary ? null : parts[1], gen: isPrimary || parts[2] === "NO_GEN" ? null : parts[2],
          storage: isPrimary ? null : Number(parts[3]), connectivity: isPrimary || parts[4] === "NO_CONN" ? null : parts[4],
          screen_size: isPrimary || parts[5] === "NO_SIZE" ? null : Number(parts[5]),
          identity_key: key, identity_tier: isPrimary ? "primary" : "fallback", stores: [...g.storeIds], offers_count: g.offers.length, parser_version: "tablet-v1",
        },
        is_active: true, tps_identity_key: key, tps_version: "tablet-v1", variant_key: key,
        identity_confidence: groupConf, data_quality_score: Math.max(60, groupConf - 10), created_at: now, data_updated_at: now,
      });
      for (const o of g.offers) {
        const normId = stableUuid(`norm:tablet:raw_observations:${o.obsId}`);
        (o as { _normId?: string })._normId = normId; processedObsIds.add(o.obsId);
        normalizedRows.push({
          id: normId, source_table: "raw_observations", source_record_id: stableUuid(`raw_observations:${o.obsId}`),
          store_id: String(o.storeId), canonical_product_id: canonicalId, raw_name: o.name, detected_category: "tablet",
          language: "ar", brand: parts[0], model_number: isPrimary ? parts[1].slice(6) : null, color: (o.payload.color as string) ?? null,
          identity_key: key, identity_key_status: o.status,
          normalized_payload: { ...(o.payload || {}), _raw_id: o.obsId, _url: o.url },
          confidence: o.confidence, missing_critical: [], ambiguity_flags: [], needs_llm: false, ignored_terms: [],
          normalizer_version: "tablet-v1", tps_version: "tablet-v1", observed_at: now, plugin_version: "tablet-v1",
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
    if (error) throw new Error(`write_ac_batch(tablet): ${error.message}`);
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
  runTabletBatch({
    category: "tablet",
    dryRun: process.env.DRY_RUN !== "false",
    limit: Number(process.env.TABLET_TOTAL_LIMIT || 500),
    expectedFingerprint: "vyceqrzttspyycdpojtn",
    source: "manual",
    dumpIdsPath: process.env.DUMP_IDS,
  }).then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.success ? 0 : 1); })
    .catch((e) => { console.error(e); process.exit(1); });
}
