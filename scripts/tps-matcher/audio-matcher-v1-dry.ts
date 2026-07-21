// scripts/tps-matcher/audio-matcher-v1-dry.ts
// Category-specific AUDIO matcher (Audio Identity Contract v1). Importable
// (runAudioBatch) + CLI. Uses audioPlugin ONLY. Balanced multi-store fetch,
// hard-capped so total <= limit (<=500). Writes ONLY >=2-store-corroborated,
// VALID candidates via write_ac_batch with category='audio'. Price-band guard.
// Dry-run-first; idempotent; rollback via canonical_ids.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { pickBestUrl } from "../tps-core/url-util";
import { audioPlugin, normalize as audioNormalize } from "../tps-plugins/audio";
import {
  type TpsBatchOptions, type TpsBatchResult,
  assertBatchInvariants, assertFingerprint, perStoreLimit,
} from "../tps-core/tps-batch";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const AUDIO_STORES = [{ id: 1, name: "جرير" }, { id: 4, name: "اكسترا" }, { id: 2, name: "أمازون" }, { id: 5, name: "المنيع" }];
const AUDIO_FILTER = ["raw_name.ilike.%headphone%", "raw_name.ilike.%سماعة%", "raw_name.ilike.%earbuds%", "raw_name.ilike.%airpods%", "raw_name.ilike.%speaker%", "raw_name.ilike.%مكبر صوت%", "raw_name.ilike.%earphone%", "raw_name.ilike.%buds%"].join(",");

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
const BRAND_AR: Record<string, string> = { apple: "ابل", sony: "سوني", bose: "بوز", jbl: "جي بي إل", samsung: "سامسونج", anker: "أنكر", huawei: "هواوي", sennheiser: "سنهايزر", marshall: "مارشال", jabra: "جابرا", beats: "بيتس" };
const TYPE_EN: Record<string, string> = { earbuds: "Earbuds", over_ear: "Headphones", speaker: "Speaker" };
const TYPE_AR: Record<string, string> = { earbuds: "سماعات أذن", over_ear: "سماعة رأس", speaker: "مكبر صوت" };
function buildNames(key: string, type: string | null): { nameAr: string; nameEn: string } {
  const [brand, model] = key.split("|");
  const bAr = BRAND_AR[brand] ?? brand;
  const bEn = brand.charAt(0).toUpperCase() + brand.slice(1);
  const modelTitle = model.replace(/\b\w/g, (m) => m.toUpperCase());
  const tEn = type ? ` ${TYPE_EN[type] ?? ""}` : "";
  const tAr = type ? ` ${TYPE_AR[type] ?? ""}` : "";
  return {
    nameEn: `${bEn} ${modelTitle}${tEn}`.replace(/\s+/g, " ").trim(),
    nameAr: `${bAr} ${modelTitle}${tAr}`.replace(/\s+/g, " ").trim(),
  };
}

export async function runAudioBatch(opts: TpsBatchOptions): Promise<TpsBatchResult> {
  const t0 = Date.now();
  const R: TpsBatchResult = {
    category: "audio", requestedLimit: opts.limit, effectiveHardLimit: opts.limit,
    fetched: 0, considered: 0, parserFailures: 0, lowConfidence: 0, conflicts: 0,
    proposedCanonicals: 0, writtenCanonicals: 0, normalized: 0, matches: 0, prices: 0,
    statusUpdates: 0, skipped: 0, durationMs: 0, success: false, dryRun: opts.dryRun, error: null,
  };
  try {
    if (opts.category !== "audio") throw new Error("category isolation: runAudioBatch only handles audio");
    assertBatchInvariants(opts);
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("no supabase env");
    assertFingerprint(SUPABASE_URL, opts.expectedFingerprint);
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

    const perStore = perStoreLimit(opts.limit, AUDIO_STORES.length);
    const rows: RawRow[] = [];
    for (const s of AUDIO_STORES) {
      const { data, error } = await supabase.from("raw_observations").select("id, store_id, store_name, raw_name, payload").eq("store_id", s.id).or(AUDIO_FILTER).order("id", { ascending: true }).limit(perStore);
      if (error) throw new Error(`fetch store ${s.id}: ${error.message}`);
      rows.push(...((data ?? []) as RawRow[]));
    }
    R.fetched = rows.length;
    if (R.fetched > opts.limit) throw new Error(`bound violation: fetched ${R.fetched} > limit ${opts.limit}`);

    const offers: { obsId: number; storeId: number | null; store: string; key: string; status: string; price: number | null; name: string; url: string | null; confidence: number; type: string | null; payload: Record<string, unknown> }[] = [];
    for (const row of rows) {
      const { nameAr, nameEn, brand, url, payload } = adaptRow(row);
      if (!audioPlugin.detect(nameAr, nameEn)) continue;
      R.considered++;
      const norm = audioNormalize(nameAr, nameEn, brand, payload);
      const identity = audioPlugin.buildIdentityKey(brand, norm.payload, {});
      if (identity.status === "invalid") { R.parserFailures++; continue; }
      if (!identity.key) continue;
      const conf = audioPlugin.scoreConfidence(brand, norm.payload, norm.model_number, norm.ambiguity_flags);
      offers.push({ obsId: row.id, storeId: row.store_id, store: row.store_name ?? "?", key: identity.key, status: identity.status, price: extractPrice(payload), name: (nameEn || nameAr), url, confidence: conf.confidence, type: (norm.payload as Record<string, unknown>).type as string | null, payload: norm.payload });
    }

    const groups = new Map<string, { offers: typeof offers }>();
    for (const o of offers) { if (o.status !== "valid") continue; if (!groups.has(o.key)) groups.set(o.key, { offers: [] }); groups.get(o.key)!.offers.push(o); }
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
      const canonicalId = stableUuid(`canonical:audio:${key}`); canonicalIds.push(canonicalId);
      const type = g.offers.find((o) => o.type)?.type ?? null;
      const { nameAr, nameEn } = buildNames(key, type);
      const parts = key.split("|");
      const groupConf = Math.min(95, Math.round(g.offers.reduce((a, b) => a + b.confidence, 0) / g.offers.length) + 5);
      canonicalRows.push({
        id: canonicalId, name_ar: nameAr, name_en: nameEn, brand: parts[0], model_number: null, category: "audio", image_url: null,
        attributes: { model: parts[1], type, identity_key: key, identity_tier: "fallback", stores: [...g.storeIds], offers_count: g.offers.length, parser_version: "audio-v1" },
        is_active: true, tps_identity_key: key, tps_version: "audio-v1", variant_key: key,
        identity_confidence: groupConf, data_quality_score: Math.max(60, groupConf - 10), created_at: now, data_updated_at: now,
      });
      for (const o of g.offers) {
        const normId = stableUuid(`norm:audio:raw_observations:${o.obsId}`);
        (o as { _normId?: string })._normId = normId; processedObsIds.add(o.obsId);
        normalizedRows.push({
          id: normId, source_table: "raw_observations", source_record_id: stableUuid(`raw_observations:${o.obsId}`),
          store_id: String(o.storeId), canonical_product_id: canonicalId, raw_name: o.name, detected_category: "audio",
          language: "ar", brand: parts[0], model_number: null, color: (o.payload.color as string) ?? null,
          identity_key: key, identity_key_status: o.status,
          normalized_payload: { ...(o.payload || {}), _raw_id: o.obsId, _url: o.url },
          confidence: o.confidence, missing_critical: [], ambiguity_flags: [], needs_llm: false, ignored_terms: [],
          normalizer_version: "audio-v1", tps_version: "audio-v1", observed_at: now, plugin_version: "audio-v1",
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
    if (error) throw new Error(`write_ac_batch(audio): ${error.message}`);
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
  runAudioBatch({
    category: "audio",
    dryRun: process.env.DRY_RUN !== "false",
    limit: Number(process.env.AUDIO_TOTAL_LIMIT || 500),
    expectedFingerprint: "vyceqrzttspyycdpojtn",
    source: "manual",
    dumpIdsPath: process.env.DUMP_IDS,
  }).then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.success ? 0 : 1); })
    .catch((e) => { console.error(e); process.exit(1); });
}
