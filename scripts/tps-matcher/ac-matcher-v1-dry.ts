// scripts/tps-matcher/ac-matcher-v1-dry.ts
// Category-specific AC matcher. Importable (runAcBatch) + CLI. Uses acPlugin
// ONLY (never mobile parsing). Balanced multi-store fetch (Extra+Almanea) by
// canonical store_id, hard-capped so total <= limit (<=500); neither store
// monopolizes. Writes ONLY >=2-store-corroborated candidates via the atomic
// write_ac_batch RPC. Single-store fallbacks and parser-invalid rows are never
// written. Marks committed observations 'done' after a successful atomic write.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { pickBestUrl } from "../tps-core/url-util";
import { acPlugin } from "../tps-plugins/ac";
import {
  type TpsBatchOptions, type TpsBatchResult,
  assertBatchInvariants, assertFingerprint, perStoreLimit,
} from "../tps-core/tps-batch";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const AC_STORES = [{ id: 4, name: "اكسترا" }, { id: 5, name: "المنيع" }];
const AC_FILTER = ["raw_name.ilike.%مكيف جداري%", "raw_name.ilike.%مكيف سبليت%", "raw_name.ilike.%Split Air Conditioner%", "raw_name.ilike.%Split AC%"].join(",");

interface RawRow { id: number; store_id: number | null; store_name: string | null; raw_name: string | null; payload: Record<string, unknown> | null; }
const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
function adaptRow(row: RawRow) {
  const p = row.payload ?? {};
  const nameAr = asString(p.nameAr) ?? asString(p.summaryAr) ?? asString(p.name) ?? asString(p.name_ar) ?? asString(row.raw_name) ?? "";
  const nameEn = asString(p.nameEn) ?? asString(p.title) ?? asString(p.name_en) ?? "";
  const brand = asString(p.brandEn) ?? asString(p.brandAr) ?? asString(p.brand) ?? null;
  const url = pickBestUrl(p);
  return { nameAr, nameEn, brand, url };
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
const BRAND_AR: Record<string, string> = { lg: "إل جي", gree: "جري", samsung: "سامسونج", tcl: "تي سي إل", westinghouse: "وايت وستنجهاوس", midea: "ميديا", haier: "هاير", hisense: "هايسنس", aux: "أوكس", general: "جنرال", zamil: "زامل", kelvinator: "كلفينيتور", mtc: "إم تي سي", classpro: "كلاس برو", crafft: "كرافت", haam: "هام" };
const COOL_AR: Record<string, string> = { cool_only: "بارد فقط", hot_cold: "حار وبارد" };
const TECH_AR: Record<string, string> = { Inverter: "انفرتر", Standard: "عادي" };
// All ac_type values the parser produces (ac/parser.ts). Localized for the customer name;
// an unmapped type falls through to itself (never crashes) rather than showing raw English.
const ACTYPE_AR: Record<string, string> = { split: "سبليت", window: "شباك", portable: "متنقل", evaporative: "صحراوي", cabinet: "دولابي", cassette: "كاسيت", ducted: "مخفي" };
const ACTYPE_EN: Record<string, string> = { split: "Split AC", window: "Window AC", portable: "Portable AC", evaporative: "Evaporative Cooler", cabinet: "Cabinet AC", cassette: "Cassette AC", ducted: "Ducted AC" };
export function buildNames(key: string) {
  const [brand, acType, series, cap, tech, cool] = key.split("|");
  // A literal "unknown" brand (parser could not identify one) must not reach the customer —
  // omit it; the type + capacity + cooling still describe the unit honestly.
  const brandKnown = !!brand && brand !== "unknown";
  const bAr = brandKnown ? (BRAND_AR[brand] ?? brand) : "";
  const bEn = brandKnown ? brand.charAt(0).toUpperCase() + brand.slice(1) : "";
  const seriesAr = series === "NO_SERIES" ? "" : ` ${series}`;
  const seriesEn = series === "NO_SERIES" ? "" : ` ${series}`;
  // Technology is a COMMERCIAL VARIANT that is often unspecified; the identity carries a
  // NO_TECH sentinel then. Like NO_SERIES/NO_STORAGE, it must NEVER reach the customer —
  // omit the segment entirely rather than render "NO_TECH". (NA guarded defensively.)
  const techKnown = !!tech && tech !== "NO_TECH" && tech !== "NA";
  const coolSafe = cool ?? "";
  const acTypeAr = acType ? (ACTYPE_AR[acType] ?? acType) : "";
  const acTypeEn = acType ? (ACTYPE_EN[acType] ?? acType) : "";
  // Build from non-empty segments so dropping tech/brand never leaves a dangling "، ،" / double space.
  const nameAr = [`مكيف ${acTypeAr}${seriesAr} ${bAr}`.trim(), cap ? `${cap} وحدة` : "", techKnown ? (TECH_AR[tech] ?? tech) : "", COOL_AR[coolSafe] ?? coolSafe]
    .filter((s) => s && s.trim()).join("، ").replace(/\s+/g, " ").trim();
  const nameEn = [`${bEn}${seriesEn} ${acTypeEn} ${cap ? cap + " BTU" : ""}`.trim(), techKnown ? tech : "", coolSafe.replace("_", " ")]
    .filter((s) => s && s.trim()).join(" ").replace(/\s+/g, " ").trim();
  return { nameAr, nameEn };
}

export async function runAcBatch(opts: TpsBatchOptions): Promise<TpsBatchResult> {
  const t0 = Date.now();
  const R: TpsBatchResult = {
    category: "air_conditioner", requestedLimit: opts.limit, effectiveHardLimit: opts.limit,
    fetched: 0, considered: 0, parserFailures: 0, lowConfidence: 0, conflicts: 0,
    proposedCanonicals: 0, writtenCanonicals: 0, normalized: 0, matches: 0, prices: 0,
    statusUpdates: 0, skipped: 0, durationMs: 0, success: false, dryRun: opts.dryRun, error: null,
  };
  try {
    if (opts.category !== "air_conditioner") throw new Error("category isolation: runAcBatch only handles air_conditioner");
    assertBatchInvariants(opts);
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("no supabase env");
    assertFingerprint(SUPABASE_URL, opts.expectedFingerprint);
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

    const perStore = perStoreLimit(opts.limit, AC_STORES.length);
    const rows: RawRow[] = [];
    for (const s of AC_STORES) {
      const { data, error } = await supabase.from("raw_observations").select("id, store_id, store_name, raw_name, payload").eq("store_id", s.id).or(AC_FILTER).order("id", { ascending: true }).limit(perStore);
      if (error) throw new Error(`fetch store ${s.id}: ${error.message}`);
      rows.push(...((data ?? []) as RawRow[]));
    }
    R.fetched = rows.length;
    // HARD BOUND assertion — total observations can never exceed the requested limit.
    if (R.fetched > opts.limit) throw new Error(`bound violation: fetched ${R.fetched} > limit ${opts.limit}`);

    const offers: { obsId: number; storeId: number | null; store: string; key: string; status: string; price: number | null; name: string; url: string | null; payload: Record<string, unknown> }[] = [];
    for (const row of rows) {
      const { nameAr, nameEn, brand, url } = adaptRow(row);
      if (!acPlugin.detect(nameAr, nameEn)) continue;
      R.considered++;
      const norm = acPlugin.normalize(nameAr, nameEn, brand);
      const identity = acPlugin.buildIdentityKey(brand, norm.payload, { technology_inferred: norm.technology_inferred });
      if (identity.status === "invalid") { R.parserFailures++; continue; }
      if (identity.status === "low_confidence_candidate") R.lowConfidence++;
      if (!identity.key) continue;
      offers.push({ obsId: row.id, storeId: row.store_id, store: row.store_name ?? "?", key: identity.key, status: identity.status, price: extractPrice(row.payload ?? {}), name: (nameAr || nameEn), url, payload: norm.payload as Record<string, unknown> });
    }

    const groups = new Map<string, { storeIds: Set<number>; offers: typeof offers }>();
    for (const o of offers) { if (!groups.has(o.key)) groups.set(o.key, { storeIds: new Set(), offers: [] }); const g = groups.get(o.key)!; if (o.storeId != null) g.storeIds.add(o.storeId); g.offers.push(o); }
    const safe = [...groups.entries()].filter(([, g]) => g.storeIds.size >= 2);
    R.skipped = groups.size - safe.length;
    R.proposedCanonicals = safe.length;

    const now = new Date().toISOString();
    const canonicalRows: Record<string, unknown>[] = [], normalizedRows: Record<string, unknown>[] = [], matchRows: Record<string, unknown>[] = [], priceRows: Record<string, unknown>[] = [], canonicalIds: string[] = [];
    const processedObsIds = new Set<number>();
    for (const [key, g] of safe) {
      const canonicalId = stableUuid(`canonical:${key}`); canonicalIds.push(canonicalId);
      const { nameAr, nameEn } = buildNames(key);
      const parts = key.split("|");
      canonicalRows.push({ id: canonicalId, name_ar: nameAr, name_en: nameEn, brand: parts[0], model_number: null, category: "air_conditioner", image_url: null,
        attributes: { ac_type: parts[1], series_or_platform: parts[2] === "NO_SERIES" ? null : parts[2], capacity_btu: Number(parts[3]), technology: parts[4], cooling_mode: parts[5], identity_key: key, stores: [...g.storeIds], offers_count: g.offers.length, parser_version: "ac-v1", identity_tier: "fallback" },
        is_active: true, tps_identity_key: key, tps_version: "ac-v1", variant_key: key, identity_confidence: 80, data_quality_score: 75, created_at: now, data_updated_at: now });
      for (const o of g.offers) {
        const normId = stableUuid(`norm:raw_observations:${o.obsId}`);
        (o as { _normId?: string })._normId = normId; processedObsIds.add(o.obsId);
        normalizedRows.push({ id: normId, source_table: "raw_observations", source_record_id: stableUuid(`raw_observations:${o.obsId}`), store_id: String(o.storeId), canonical_product_id: canonicalId, raw_name: o.name, detected_category: "ac", language: "ar", brand: parts[0], model_number: null, color: null, identity_key: key, identity_key_status: o.status, normalized_payload: { ...(o.payload || {}), _raw_id: o.obsId, _url: o.url }, confidence: 80, missing_critical: [], ambiguity_flags: [], needs_llm: false, ignored_terms: [], normalizer_version: "ac-v1", tps_version: "ac-v1", observed_at: now, plugin_version: "ac-v1" });
      }
      for (const sid of g.storeIds) {
        const so = g.offers.filter((o) => o.storeId === sid);
        const priced = so.filter((o) => o.price !== null);
        const rep = (priced.length ? priced.reduce((a, b) => (a.price! <= b.price! ? a : b)) : so[0]) as { _normId?: string; store: string; price: number | null };
        matchRows.push({ raw_observation_id: rep._normId, canonical_product_id: canonicalId, match_method: "tps_identity_key", confidence: 80, is_verified: false, matched_at: now, identity_resolution_event_id: null });
        if (priced.length) priceRows.push({ canonical_product_id: canonicalId, store_name: rep.store, price: rep.price, tps_observation_id: rep._normId, observed_at: now });
      }
    }
    R.normalized = normalizedRows.length; R.matches = matchRows.length;

    // Append only changed prices (respect append-only history / no duplicate unchanged rows).
    const lastPrice = new Map<string, number>();
    if (canonicalIds.length) {
      const { data: hist } = await supabase.from("price_history").select("canonical_product_id, store_name, price, observed_at").in("canonical_product_id", canonicalIds).order("observed_at", { ascending: false });
      for (const h of hist ?? []) { const k = `${h.canonical_product_id}|${h.store_name}`; if (!lastPrice.has(k)) lastPrice.set(k, Number(h.price)); }
    }
    const changedPrices = priceRows.filter((pr) => { const last = lastPrice.get(`${pr.canonical_product_id}|${pr.store_name}`); return last === undefined || last !== Number(pr.price); });
    R.prices = changedPrices.length;

    if (opts.dumpIdsPath) {
      // local only; never in production
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("fs").writeFileSync(opts.dumpIdsPath, JSON.stringify({ canonicalIds, normalizedIds: normalizedRows.map((n) => n.id), processedObsIds: [...processedObsIds] }, null, 2));
    }

    if (opts.dryRun) { R.success = true; R.durationMs = Date.now() - t0; return R; }
    if (canonicalRows.length === 0) { R.success = true; R.durationMs = Date.now() - t0; return R; }

    const { data: result, error } = await supabase.rpc("write_ac_batch", { p_canonical: canonicalRows, p_normalized: normalizedRows, p_matches: matchRows, p_prices: changedPrices, p_canonical_ids: canonicalIds });
    if (error) throw new Error(`write_ac_batch: ${error.message}`); // leaves observations pending (no status update)
    const w = result as { canonical: number; normalized: number; matches: number; prices: number };
    R.writtenCanonicals = w.canonical; R.normalized = w.normalized; R.matches = w.matches; R.prices = w.prices;
    // Status: mark ONLY committed observations done, after success.
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

// CLI usage preserved.
if (require.main === module) {
  runAcBatch({
    category: "air_conditioner",
    dryRun: process.env.DRY_RUN !== "false",
    limit: Number(process.env.AC_TOTAL_LIMIT || (Number(process.env.AC_PER_STORE || 250) * 2)),
    expectedFingerprint: "vyceqrzttspyycdpojtn",
    source: "manual",
    dumpIdsPath: process.env.DUMP_IDS,
  }).then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.success ? 0 : 1); })
    .catch((e) => { console.error(e); process.exit(1); });
}
