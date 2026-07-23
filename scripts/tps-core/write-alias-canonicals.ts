// scripts/tps-core/write-alias-canonicals.ts
// ─────────────────────────────────────────────────────────────────────────────
// ALIAS FOLD-IN (ADR-060) — materialize identity classes that exist only because
// the MODEL: and spec key spaces were bridged by co-occurrence evidence.
//
// Follows the ADR-050 precedent exactly: CLEAN-CREATE ONLY. A class is written
// only when NONE of its observations is already attached to another canonical,
// so a duplicate product card is impossible by construction. Overlapping classes
// are DEFERRED for the careful merge, never force-merged.
//
// Safety properties (each verified by `--dry` before any write):
//   • clean-create   — no member observation already in normalized_product_observations
//   • market-scoped  — non-Saudi listings excluded (ADR-059)
//   • listing-deduped— one representative per real listing (merchant contracts)
//   • precision      — a class needs >=2 DISTINCT stores and a bridgeable spec key
//   • reversible     — every row stamped tps_version='alias-reconciliation-v1'
//   • idempotent     — deterministic ids; a re-run finds members already attached
//                      and defers them, so it can never double-write
//   • evidence-safe  — raw_observations is only ever READ
//
// Usage: npx tsx scripts/tps-core/write-alias-canonicals.ts [--dry]
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { CATEGORY_DEFS, TPS_STORES } from "./category-registry";
import { assertFingerprint } from "./tps-batch";
import { pickBestUrl } from "./url-util";
import { reconcileIdentities, corroboratedClasses, type KeyedObservation } from "../../src/lib/identity/alias-graph";
import { resolveListingIdentity, isSaudiMarket } from "../../src/lib/identity/merchant-listing-identity";

const DRY = process.argv.includes("--dry");
const VERSION = "alias-reconciliation-v1";

// CATEGORY-EARNED AUTO-STATUS (ADR-057 doctrine, ADR-060 enforcement).
// No category folds automatically. A category is passed with `--categories` only
// after its classes have been reviewed in `--dry` and measured safe.
//
// Measured 2026-07-23:
//   tablet — SAFE. Classes are MPN↔spec bridges and colour variants of one
//            buyer-facing product (Constitution Art. III: colour is a Commercial
//            Variant, not identity).
//   tv     — NOT SAFE. The spec key omits the series designation, so
//            `samsung|75|4k|qled|NO_HZ` fused Q6/Q7/Q8/QN70 — four product lines.
//            TV needs a series-aware identity contract before it can auto-fold.
const CATEGORY_ARG = process.argv[process.argv.indexOf("--categories") + 1];
const ALLOWED = new Set(
  (process.argv.includes("--categories") && CATEGORY_ARG ? CATEGORY_ARG.split(",") : []).map((s) => s.trim()).filter(Boolean)
);
const STORE_SLUG: Record<number, string> = { 1: "jarir", 2: "amazon", 3: "noon", 4: "extra", 5: "almanea", 8: "swsg" };

function stableUuid(seed: string): string {
  const h = createHash("sha256").update(seed).digest("hex");
  return [h.slice(0, 8), h.slice(8, 12), "4" + h.slice(13, 16),
    ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20), h.slice(20, 32)].join("-");
}
const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
function adaptRow(p: Record<string, unknown>, rawName: string | null) {
  return {
    nameAr: asString(p.nameAr) ?? asString(p.name_ar) ?? asString(p.name) ?? asString(rawName) ?? "",
    nameEn: asString(p.nameEn) ?? asString(p.name_en) ?? asString(p.title) ?? "",
    brand: asString(p.brandEn) ?? asString(p.brand) ?? asString(p.brandAr) ?? null,
    url: pickBestUrl(p),
  };
}
function extractPrice(p: Record<string, unknown>): number | null {
  for (const c of [p.current_price, p.sellingPrice, p.price, p.wasPrice, p.original_price]) {
    const n = typeof c === "number" ? c : Number(asString(c));
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}

interface Member { rawId: number; store: number; name: string; url: string | null; price: number | null }

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");
  const defs = Object.values(CATEGORY_DEFS);

  // 1) Scan raw observations → merchant listing identity → Saudi only → one
  //    representative per real listing → both key spaces per representative.
  const seen = new Set<string>();
  const rows: KeyedObservation[] = [];
  const members = new Map<number, Member & { category: string }>();
  let cursor = 0, scanned = 0, foreign = 0, noIdentity = 0;
  for (;;) {
    const page = await pg.query(
      `select id, store_id, raw_name, payload,
              coalesce(payload->>'productUrl', payload->>'url', payload->>'product_url', raw_url) u
       from raw_observations where id > $1 order by id asc limit 20000`, [cursor]);
    if (!page.rows.length) break;
    for (const r of page.rows) {
      cursor = Number(r.id); scanned++;
      const store = Number(r.store_id);
      const ident = resolveListingIdentity(store, r.u as string | null, STORE_SLUG[store]);
      if (!ident.key) continue;
      if (!isSaudiMarket(ident.market)) { foreign++; continue; }
      if (seen.has(ident.key)) continue;
      seen.add(ident.key);

      const p = (r.payload ?? {}) as Record<string, unknown>;
      const { nameAr, nameEn, brand, url } = adaptRow(p, r.raw_name);
      let matched = false;
      for (const def of defs) {
        if (!def.plugin.detect(nameAr, nameEn)) continue;
        const norm = def.normalize(nameAr, nameEn, brand, p);
        const withModel = def.plugin.buildIdentityKey(brand, norm.payload, { model_number: norm.model_number });
        const fallback = def.plugin.buildIdentityKey(brand, norm.payload, { model_number: null });
        const modelKey = withModel.key && withModel.key.includes("|MODEL:") ? withModel.key : null;
        const specKey = fallback.status !== "invalid" && fallback.key ? fallback.key : null;
        if (!modelKey && !specKey) break;
        rows.push({ id: Number(r.id), storeId: store, category: def.category, modelKey, specKey });
        members.set(Number(r.id), {
          rawId: Number(r.id), store, category: def.category,
          name: (nameEn || nameAr).slice(0, 400), url, price: extractPrice(p),
        });
        matched = true; break;
      }
      if (!matched) noIdentity++;
    }
  }
  console.log(`scanned=${scanned}  saudi listings=${seen.size}  non-saudi excluded=${foreign}  with identity=${rows.length}  no identity=${noIdentity}`);

  // 2) Reconcile into identity classes and keep only corroborated ones.
  const classes = reconcileIdentities(rows);
  const corrob = corroboratedClasses(classes);
  // Classes that exist ONLY because of aliasing (>1 member key) are this
  // writer's contribution; single-key classes are the existing matcher's job.
  const bridged = corrob.filter((c) => c.memberKeys.length > 1);
  console.log(`identity classes=${classes.length}  corroborated(>=2 stores)=${corrob.length}  bridged-only=${bridged.length}`);

  // 3) CLEAN-CREATE GATE — defer any class whose observations are already
  //    attached to a canonical. This is what makes duplicate cards impossible.
  const allRawIds = [...new Set(bridged.flatMap((c) => c.observationIds.map(Number)))];
  const linked = new Set<number>();
  for (let i = 0; i < allRawIds.length; i += 5000) {
    const { rows: lk } = await pg.query(
      `select distinct (normalized_payload->>'_raw_id')::bigint rid
       from normalized_product_observations
       where (normalized_payload->>'_raw_id') ~ '^[0-9]+$'
         and (normalized_payload->>'_raw_id')::bigint = any($1)`, [allRawIds.slice(i, i + 5000)]);
    for (const r of lk) linked.add(Number(r.rid));
  }
  const attachedClean = bridged.filter((c) => c.observationIds.every((id) => !linked.has(Number(id))));
  const deferredAttached = bridged.length - attachedClean.length;

  // SECOND CLEAN-CREATE GATE — no duplicate CARD. An observation-level check is
  // not sufficient: a canonical for the same brand+model (or the same identity
  // key) may already exist from another source (e.g. model-corroboration) while
  // holding different observations. `canonical_products_brand_model_number_idx`
  // enforces this in the database; we must respect it BEFORE writing, not
  // discover it as a failed batch.
  const { rows: existing } = await pg.query(
    `select lower(brand) brand, upper(model_number) model, tps_identity_key from canonical_products where is_active`
  );
  const takenModel = new Set(existing.filter((r) => r.model).map((r) => `${r.brand}|${r.model}`));
  const takenKey = new Set(existing.map((r) => r.tps_identity_key).filter(Boolean));
  const collides = (c: { canonicalKey: string; memberKeys: string[] }) => {
    if (takenKey.has(c.canonicalKey)) return true;
    if (c.memberKeys.some((k) => takenKey.has(k))) return true;
    const brand = c.canonicalKey.split("|")[0].toLowerCase();
    return c.memberKeys.some((k) => k.includes("|MODEL:") && takenModel.has(`${brand}|${k.split("|MODEL:")[1].toUpperCase()}`));
  };
  const cleanAll = attachedClean.filter((c) => !collides(c));
  const deferredCollision = attachedClean.length - cleanAll.length;
  console.log(`clean-create eligible=${cleanAll.length}  deferred: attached=${deferredAttached}  card-collision=${deferredCollision}`);

  const byCatAll: Record<string, number> = {};
  for (const c of cleanAll) byCatAll[c.category] = (byCatAll[c.category] ?? 0) + 1;
  console.log("clean by category:", JSON.stringify(byCatAll));

  // Category gate — a category writes only once it has EARNED auto-status.
  const clean = cleanAll.filter((c) => ALLOWED.has(c.category));
  const gatedOut = cleanAll.length - clean.length;
  console.log(`allowed categories=[${[...ALLOWED].join(",") || "(none)"}]  writable=${clean.length}  gated-out=${gatedOut}`);

  if (DRY) {
    console.log("\nALL clean-create alias classes (review before granting a category auto-status):");
    for (const c of cleanAll) {
      const mark = ALLOWED.has(c.category) ? "WRITE" : "gated";
      console.log(`  [${mark}][${c.category}] stores=${c.storeIds.join(",")}  ${c.memberKeys.join("  ==  ")}`);
    }
    await pg.end(); return;
  }
  if (!clean.length) { console.log("nothing writable — pass --categories <list> after reviewing --dry"); await pg.end(); return; }

  // 4) Write through the verified RPC, bounded chunks.
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || "", { auth: { persistSession: false } });
  const now = new Date().toISOString();
  let written = 0;
  for (let i = 0; i < clean.length; i += 100) {
    const chunk = clean.slice(i, i + 100);
    const canonicalRows: Record<string, unknown>[] = [], normalizedRows: Record<string, unknown>[] = [],
      matchRows: Record<string, unknown>[] = [], priceRows: Record<string, unknown>[] = [], ids: string[] = [];
    for (const c of chunk) {
      const key = c.canonicalKey;
      const cid = stableUuid(`canonical:alias:${c.category}:${key}`); ids.push(cid);
      const obs = c.observationIds.map((id) => members.get(Number(id))!).filter(Boolean);
      if (!obs.length) continue;
      const stores = new Set(obs.map((o) => o.store));
      const conf = Math.min(94, 80 + stores.size * 3);
      const display = obs.map((o) => o.name).sort((a, b) => b.length - a.length)[0] || key;
      const brand = key.split("|")[0];
      // A class with SEVERAL model keys is a variant group (colour/region), not a
      // single manufacturer SKU — picking one arbitrarily would assert a false
      // model_number and collide with the brand+model uniqueness guard.
      const modelKeys = c.memberKeys.filter((k) => k.includes("|MODEL:"));
      const modelKey = modelKeys.length === 1 ? modelKeys[0] : undefined;
      canonicalRows.push({
        id: cid, name_ar: display, name_en: display, brand,
        model_number: modelKey ? modelKey.split("|MODEL:")[1] : null,
        category: c.category, image_url: null,
        attributes: {
          identity_key: key, identity_tier: modelKey ? "primary" : "fallback",
          alias_keys: c.memberKeys, stores: [...stores], offers_count: obs.length,
          parser_version: VERSION, source: "alias_reconciliation", comparison_eligible: true,
        },
        is_active: true, tps_identity_key: key, tps_version: VERSION, variant_key: key,
        identity_confidence: conf, data_quality_score: Math.max(60, conf - 10),
        created_at: now, data_updated_at: now,
      });
      const normById = new Map<number, string>();
      for (const o of obs) {
        const nid = stableUuid(`norm:alias:raw_observations:${o.rawId}`); normById.set(o.rawId, nid);
        normalizedRows.push({
          id: nid, source_table: "raw_observations", source_record_id: stableUuid(`raw_observations:${o.rawId}`),
          store_id: String(o.store), canonical_product_id: cid, raw_name: o.name, detected_category: c.category,
          language: "ar", brand, model_number: modelKey ? modelKey.split("|MODEL:")[1] : null, color: null,
          identity_key: key, identity_key_status: "valid",
          normalized_payload: { _raw_id: o.rawId, _url: o.url, alias_keys: c.memberKeys },
          confidence: conf, missing_critical: [], ambiguity_flags: [], needs_llm: false, ignored_terms: [],
          normalizer_version: VERSION, tps_version: VERSION, observed_at: now, plugin_version: VERSION,
        });
      }
      for (const sid of stores) {
        const so = obs.filter((o) => o.store === sid);
        const priced = so.filter((o) => o.price != null);
        const r = priced.length ? priced.reduce((a, b) => (a.price! <= b.price! ? a : b)) : so[0];
        matchRows.push({ raw_observation_id: normById.get(r.rawId), canonical_product_id: cid, match_method: "alias_reconciliation", confidence: conf, is_verified: false, matched_at: now, identity_resolution_event_id: null });
        if (priced.length) priceRows.push({ canonical_product_id: cid, store_name: TPS_STORES.find((s) => s.id === sid)?.name ?? String(sid), price: r.price, tps_observation_id: normById.get(r.rawId), observed_at: now });
      }
    }
    if (!canonicalRows.length) continue;
    const { data, error } = await sb.rpc("write_ac_batch", { p_canonical: canonicalRows, p_normalized: normalizedRows, p_matches: matchRows, p_prices: priceRows, p_canonical_ids: ids });
    if (error) throw new Error(`write_ac_batch: ${error.message}`);
    written += (data as { canonical: number }).canonical;
  }
  console.log(`\nALIAS CANONICALS written=${written}  (tps_version='${VERSION}' — reversible via is_active)`);
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
