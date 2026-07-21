// scripts/tps-matcher/ac-matcher-v1-dry.ts
// Category-specific AC matcher. DRY_RUN by default. Uses acPlugin ONLY (never
// mobile parsing). Balanced multi-store fetch (Extra+Almanea) by canonical
// store_id, hard-capped so total <= 2 * AC_PER_STORE (<=500); neither store
// monopolizes. Writes ONLY >=2-store-corroborated candidates via the atomic
// write_ac_batch RPC. Single-store fallbacks and parser-invalid rows are never
// written. Marks committed observations 'done' after a successful atomic write.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { acPlugin } from "../tps-plugins/ac";
import { canonicalizeBrand } from "../tps-core/brand-map";

const DRY_RUN = process.env.DRY_RUN !== "false";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error("no supabase env"); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const AC_STORES = [{ id: 4, name: "اكسترا" }, { id: 5, name: "المنيع" }];
const AC_FILTER = ["raw_name.ilike.%مكيف جداري%", "raw_name.ilike.%مكيف سبليت%", "raw_name.ilike.%Split Air Conditioner%", "raw_name.ilike.%Split AC%"].join(",");

interface RawRow { id: number; store_id: number | null; store_name: string | null; raw_name: string | null; payload: Record<string, unknown> | null; }
const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
function adaptRow(row: RawRow) {
  const p = row.payload ?? {};
  const nameAr = asString(p.nameAr) ?? asString(p.summaryAr) ?? asString(p.name) ?? asString(p.name_ar) ?? asString(row.raw_name) ?? "";
  const nameEn = asString(p.nameEn) ?? asString(p.title) ?? asString(p.name_en) ?? "";
  const brand = asString(p.brandEn) ?? asString(p.brandAr) ?? asString(p.brand) ?? null;
  return { nameAr, nameEn, brand };
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
function buildNames(key: string) {
  const [brand, acType, series, cap, tech, cool] = key.split("|");
  const bAr = BRAND_AR[brand] ?? brand;
  const bEn = brand.charAt(0).toUpperCase() + brand.slice(1);
  const seriesAr = series === "NO_SERIES" ? "" : ` ${series}`;
  const seriesEn = series === "NO_SERIES" ? "" : ` ${series}`;
  const nameAr = `مكيف ${acType === "split" ? "سبليت" : acType}${seriesAr} ${bAr}، ${cap} وحدة، ${TECH_AR[tech] ?? tech}، ${COOL_AR[cool] ?? cool}`.replace(/\s+/g, " ").trim();
  const nameEn = `${bEn}${seriesEn} ${acType === "split" ? "Split AC" : acType} ${cap} BTU ${tech} ${cool.replace("_", " ")}`.replace(/\s+/g, " ").trim();
  return { nameAr, nameEn };
}

async function fetchStore(storeId: number, limit: number): Promise<RawRow[]> {
  const { data, error } = await supabase.from("raw_observations").select("id, store_id, store_name, raw_name, payload").eq("store_id", storeId).or(AC_FILTER).order("id", { ascending: true }).limit(limit);
  if (error) { console.error(`store ${storeId}:`, error.message); process.exit(1); }
  return (data ?? []) as RawRow[];
}

interface Offer { obsId: number; storeId: number | null; store: string; key: string; status: string; price: number | null; name: string; payload: Record<string, unknown>; }

async function main() {
  const PER_STORE = Number(process.env.AC_PER_STORE || 250);
  console.log("═".repeat(70));
  console.log(`AC MATCHER v1 — WRITE [DRY_RUN=${DRY_RUN}]  (acPlugin ${acPlugin.category} v${acPlugin.version})`);
  console.log(DRY_RUN ? "⚠️ simulation — no writes." : "🔴 real write.");
  console.log("═".repeat(70));

  const perStoreRows: Record<string, number> = {};
  const rows: RawRow[] = [];
  for (const s of AC_STORES) { const r = await fetchStore(s.id, PER_STORE); perStoreRows[s.name] = r.length; rows.push(...r); }
  console.log("fetched:", JSON.stringify(perStoreRows), "| total:", rows.length, "(hard cap", 2 * PER_STORE + ")");

  const offers: Offer[] = [];
  const detectByStore: Record<string, number> = {};
  const statusCount: Record<string, number> = { valid: 0, low_confidence_candidate: 0, invalid: 0 };
  const parserFailures: { obsId: number; reason: string }[] = [];
  for (const row of rows) {
    const store = row.store_name ?? "?";
    const { nameAr, nameEn, brand } = adaptRow(row);
    if (!acPlugin.detect(nameAr, nameEn)) continue;
    detectByStore[store] = (detectByStore[store] ?? 0) + 1;
    const norm = acPlugin.normalize(nameAr, nameEn, brand);
    const identity = acPlugin.buildIdentityKey(brand, norm.payload, { technology_inferred: norm.technology_inferred });
    statusCount[identity.status] = (statusCount[identity.status] ?? 0) + 1;
    if (identity.status === "invalid") { parserFailures.push({ obsId: row.id, reason: identity.reason ?? "?" }); continue; }
    if (!identity.key) continue;
    offers.push({ obsId: row.id, storeId: row.store_id, store, key: identity.key, status: identity.status, price: extractPrice(row.payload ?? {}), name: (nameAr || nameEn), payload: norm.payload as any });
  }

  const groups = new Map<string, { storeIds: Set<number>; offers: Offer[] }>();
  for (const o of offers) { if (!groups.has(o.key)) groups.set(o.key, { storeIds: new Set(), offers: [] }); const g = groups.get(o.key)!; if (o.storeId != null) g.storeIds.add(o.storeId); g.offers.push(o); }
  // SAFE = >=2 independent stores (fallback corroboration). Single-store never written.
  const safe = [...groups.entries()].filter(([, g]) => g.storeIds.size >= 2);
  console.log("\n① detect:", JSON.stringify(detectByStore), "| ② status:", JSON.stringify(statusCount));
  console.log("③ keys:", groups.size, "| >=2-store SAFE:", safe.length, "| single-store (rejected):", groups.size - safe.length, "| ④ parser failures:", parserFailures.length);

  // Build deterministic write rows for SAFE candidates only.
  const now = new Date().toISOString();
  const canonicalRows: any[] = [], normalizedRows: any[] = [], matchRows: any[] = [], priceRows: any[] = [], canonicalIds: string[] = [];
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
      (o as any)._normId = normId; processedObsIds.add(o.obsId);
      normalizedRows.push({ id: normId, source_table: "raw_observations", source_record_id: stableUuid(`raw_observations:${o.obsId}`), store_id: String(o.storeId), canonical_product_id: canonicalId, raw_name: o.name, detected_category: "ac", language: "ar", brand: parts[0], model_number: null, color: null, identity_key: key, identity_key_status: o.status, normalized_payload: { ...(o.payload || {}), _raw_id: o.obsId }, confidence: 80, missing_critical: [], ambiguity_flags: [], needs_llm: false, ignored_terms: [], normalizer_version: "ac-v1", tps_version: "ac-v1", observed_at: now, plugin_version: "ac-v1" });
    }
    for (const sid of g.storeIds) {
      const so = g.offers.filter((o) => o.storeId === sid);
      const priced = so.filter((o) => o.price !== null);
      const rep = priced.length ? priced.reduce((a, b) => (a.price! <= b.price! ? a : b)) : so[0];
      matchRows.push({ raw_observation_id: (rep as any)._normId, canonical_product_id: canonicalId, match_method: "tps_identity_key", confidence: 80, is_verified: false, matched_at: now, identity_resolution_event_id: null });
      if (priced.length) priceRows.push({ canonical_product_id: canonicalId, store_name: rep.store, price: rep.price, tps_observation_id: (rep as any)._normId, observed_at: now });
    }
  }

  // Append only changed prices (respect append-only history).
  const lastPrice = new Map<string, number>();
  if (canonicalIds.length) {
    const { data: hist } = await supabase.from("price_history").select("canonical_product_id, store_name, price, observed_at").in("canonical_product_id", canonicalIds).order("observed_at", { ascending: false });
    for (const h of hist ?? []) { const k = `${h.canonical_product_id}|${h.store_name}`; if (!lastPrice.has(k)) lastPrice.set(k, Number(h.price)); }
  }
  const changedPrices = priceRows.filter((pr) => { const last = lastPrice.get(`${pr.canonical_product_id}|${pr.store_name}`); return last === undefined || last !== Number(pr.price); });

  console.log(`📦 canonical=${canonicalRows.length} | normalized=${normalizedRows.length} | matches=${matchRows.length} | price(changed)=${changedPrices.length}/${priceRows.length}`);
  if (safe.length) { console.log("\nSAFE candidates:"); safe.forEach(([k, g]) => console.log(`   ${k} | stores ${[...g.storeIds].join("+")} | offers ${g.offers.length}`)); }

  if (process.env.DUMP_IDS) require("fs").writeFileSync(process.env.DUMP_IDS, JSON.stringify({ perStoreRows, canonicalIds, safeKeys: safe.map(([k, g]) => ({ key: k, storeIds: [...g.storeIds] })), normalizedIds: normalizedRows.map((n) => n.id), processedObsIds: [...processedObsIds], parserFailureObsIds: parserFailures.map((p) => p.obsId) }, null, 2));

  if (DRY_RUN) { console.log("\n⚠️ DRY_RUN — no data written."); return; }
  if (canonicalRows.length === 0) { console.log("\nNo safe candidates — nothing to write."); return; }

  const { data: result, error } = await supabase.rpc("write_ac_batch", { p_canonical: canonicalRows, p_normalized: normalizedRows, p_matches: matchRows, p_prices: changedPrices, p_canonical_ids: canonicalIds });
  if (error) { console.error("❌ write_ac_batch failed:", error.message); process.exit(1); }
  console.log("✅ write complete:", JSON.stringify(result));
  // Phase 3 status semantics: mark ONLY committed observations 'done', after success.
  const obsIds = [...processedObsIds]; let marked = 0;
  for (let i = 0; i < obsIds.length; i += 200) { const { error: e } = await supabase.from("raw_observations").update({ processing_status: "done" }).in("id", obsIds.slice(i, i + 200)); if (e) { console.error("⚠️ status update failed:", e.message); break; } marked += Math.min(200, obsIds.length - i); }
  console.log(`🏷️ marked ${marked}/${obsIds.length} observations done.`);
}
main().catch((e) => { console.error("failed:", e); process.exit(1); });
