// scripts/tps-core/write-model-canonicals.ts
// Fold cross-store MODEL-NUMBER corroborations into canonical_products — SAFELY.
// Evidence (ADR-049 follow-up): ~93% of model-corroborated observations are
// UNRESOLVED (no canonical), so writing them is a clean CREATE, not a merge. To
// guarantee NO duplicate product cards, we write a model canonical ONLY when NONE
// of its observations already belong to an existing canonical; groups that overlap
// an existing canonical are DEFERRED (reported) for the careful merge milestone.
// High precision (model+brand+cross-store+price gates from the tested pure module).
// Writes through the verified write_ac_batch RPC. Idempotent. `--dry` to preview.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { assertFingerprint } from "./tps-batch";
import { TPS_STORES } from "./category-registry";
import { canonicalizeBrand } from "./brand-map";
import { determineCategory } from "../../src/lib/scraping/utils/category-utils";
import { normalizeModel, qualifyModelGroup, type ModelObs } from "../../src/lib/intelligence/model-corroboration";

const DRY = process.argv.includes("--dry");
// determineCategory labels → agent/TPS categories; excluded ⇒ don't create a canonical.
const CAT_MAP: Record<string, string> = { smartphone: "mobile", tablet: "tablet", laptop: "laptop", tv: "tv", air_conditioner: "air_conditioner", smartwatch: "smartwatch", monitor: "monitor" };
const EXCLUDE = new Set(["accessories", "other"]);

function stableUuid(seed: string): string {
  const h = createHash("sha256").update(seed).digest("hex");
  return [h.slice(0, 8), h.slice(8, 12), "4" + h.slice(13, 16), ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20), h.slice(20, 32)].join("-");
}
const asStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
function extractPrice(p: Record<string, unknown>): number | null {
  for (const c of [p.current_price, p.sellingPrice, p.price]) { const n = typeof c === "number" ? c : Number(String(c ?? "").replace(/[^0-9.]/g, "")); if (Number.isFinite(n) && n > 0) return Math.round(n); }
  return null;
}

interface Row extends ModelObs { id: number; name: string; url: string | null }

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect(); await pg.query("set statement_timeout = 0");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  // 1) Build model groups.
  const groups = new Map<string, Row[]>(); let lastId = 0; const PAGE = 5000;
  for (;;) {
    const { rows } = await pg.query(`select id, store_id, raw_name, payload from raw_observations where id > $1 and coalesce(payload->>'modelNumber', payload->>'model') is not null order by id asc limit $2`, [lastId, PAGE]);
    if (!rows.length) break;
    for (const r of rows) {
      lastId = Number(r.id);
      const p = (r.payload ?? {}) as Record<string, unknown>;
      const model = normalizeModel(asStr(p.modelNumber) ?? asStr(p.model)); if (!model) continue;
      const brand = canonicalizeBrand(asStr(p.brandEn) ?? asStr(p.brand) ?? asStr(p.brandAr));
      const name = asStr(p.nameEn) ?? asStr(p.nameAr) ?? asStr(r.raw_name) ?? "";
      const url = asStr(p.productUrl) ?? asStr(p.urlEn) ?? asStr(p.url) ?? asStr(p.product_url);
      (groups.get(model) ?? groups.set(model, []).get(model)!).push({ id: Number(r.id), store: Number(r.store_id), brand, price: extractPrice(p), name, url });
    }
  }

  // 2) Qualify + category-filter, collect candidate obs ids for the linkage check.
  const candidates: { model: string; brand: string; category: string; obs: Row[] }[] = [];
  const allIds: number[] = [];
  for (const [model, obs] of groups) {
    const q = qualifyModelGroup(obs); if (!q.ok) continue;
    const det = determineCategory(obs.map((o) => o.name).sort((a, b) => b.length - a.length)[0] || "") || "other";
    if (EXCLUDE.has(det)) continue;
    const category = CAT_MAP[det] ?? det;
    candidates.push({ model, brand: q.brand, category, obs }); for (const o of obs) allIds.push(o.id);
  }

  // 3) Which candidate observations are ALREADY linked to a canonical? (avoid duplicates)
  const linked = new Set<number>();
  for (let i = 0; i < allIds.length; i += 2000) {
    const { rows } = await pg.query(`select (normalized_payload->>'_raw_id')::bigint rid from normalized_product_observations where (normalized_payload->>'_raw_id')::bigint = any($1)`, [allIds.slice(i, i + 2000)]);
    for (const r of rows) if (r.rid != null) linked.add(Number(r.rid));
  }

  // 4) Clean groups = none of its observations already linked.
  const clean = candidates.filter((c) => c.obs.every((o) => !linked.has(o.id)));
  const deferred = candidates.length - clean.length;
  const byCat: Record<string, number> = {}; for (const c of clean) byCat[c.category] = (byCat[c.category] ?? 0) + 1;
  console.log(`candidates=${candidates.length}  clean(create)=${clean.length}  deferred(overlap→merge later)=${deferred}`);
  console.log("clean by category:", JSON.stringify(byCat));
  if (DRY) { console.log("\nsample clean:"); clean.slice(0, 10).forEach((c) => console.log(`  ${c.brand}|${c.model} [${c.category}] stores=${[...new Set(c.obs.map((o) => o.store))]} — ${(c.obs.map((o) => o.name).sort((a, b) => b.length - a.length)[0] || "").slice(0, 50)}`)); await pg.end(); return; }

  // 5) Build rows + write through the verified RPC (bounded chunks).
  const now = new Date().toISOString(); let written = 0;
  for (let i = 0; i < clean.length; i += 100) {
    const chunk = clean.slice(i, i + 100);
    const canonicalRows: Record<string, unknown>[] = [], normalizedRows: Record<string, unknown>[] = [], matchRows: Record<string, unknown>[] = [], priceRows: Record<string, unknown>[] = [], ids: string[] = [];
    for (const c of chunk) {
      const key = `${c.brand}|MODEL:${c.model}`; const cid = stableUuid(`canonical:model:${key}`); ids.push(cid);
      const stores = new Set(c.obs.map((o) => o.store)); const conf = Math.min(96, 82 + stores.size * 3);
      const display = c.obs.map((o) => o.name).sort((a, b) => b.length - a.length)[0] || `${c.brand} ${c.model}`;
      canonicalRows.push({ id: cid, name_ar: display, name_en: display, brand: c.brand, model_number: c.model, category: c.category, image_url: null,
        attributes: { identity_key: key, identity_tier: "primary", model_number: c.model, stores: [...stores], offers_count: c.obs.length, parser_version: "model-corroboration-v1", source: "model_corroboration", comparison_eligible: true },
        is_active: true, tps_identity_key: key, tps_version: "model-corroboration-v1", variant_key: key, identity_confidence: conf, data_quality_score: Math.max(60, conf - 10), created_at: now, data_updated_at: now });
      const normById = new Map<number, string>();
      for (const o of c.obs) {
        const nid = stableUuid(`norm:model:raw_observations:${o.id}`); normById.set(o.id, nid);
        normalizedRows.push({ id: nid, source_table: "raw_observations", source_record_id: stableUuid(`raw_observations:${o.id}`), store_id: String(o.store), canonical_product_id: cid, raw_name: o.name.slice(0, 400), detected_category: c.category, language: "ar", brand: c.brand, model_number: c.model, color: null, identity_key: key, identity_key_status: "valid", normalized_payload: { _raw_id: o.id, _url: o.url, model: c.model }, confidence: conf, missing_critical: [], ambiguity_flags: [], needs_llm: false, ignored_terms: [], normalizer_version: "model-corroboration-v1", tps_version: "model-corroboration-v1", observed_at: now, plugin_version: "model-corroboration-v1" });
      }
      for (const sid of stores) {
        const so = c.obs.filter((o) => o.store === sid); const priced = so.filter((o) => o.price != null);
        const r = priced.length ? priced.reduce((a, b) => (a.price! <= b.price! ? a : b)) : so[0];
        matchRows.push({ raw_observation_id: normById.get(r.id), canonical_product_id: cid, match_method: "model_number", confidence: conf, is_verified: false, matched_at: now, identity_resolution_event_id: null });
        if (priced.length) priceRows.push({ canonical_product_id: cid, store_name: TPS_STORES.find((s) => s.id === sid)?.name ?? String(sid), price: r.price, tps_observation_id: normById.get(r.id), observed_at: now });
      }
    }
    const { data, error } = await sb.rpc("write_ac_batch", { p_canonical: canonicalRows, p_normalized: normalizedRows, p_matches: matchRows, p_prices: priceRows, p_canonical_ids: ids });
    if (error) throw new Error(`write_ac_batch: ${error.message}`);
    written += (data as { canonical: number }).canonical;
  }
  console.log(`\nMODEL CANONICALS written=${written}`);
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
