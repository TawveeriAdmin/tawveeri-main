// AC Rescue Lab — Final Pre-Pilot Gate. READ-ONLY (SELECT only).
// (A) full audit of the TCL and Haier reference canonicals behind the 2 genuinely-novel
//     HIGH_CONFIDENCE rescues, same depth as Phase 3's 20-canonical audit.
// (B) population-wide scan of low-confidence-tier AC canonicals for the proven
//     AI-Pro/AI-Plus/Cosmo series-collapse signature (scope only, no fix).
// (C) population-wide scan (all categories) for the corrupted-brand-token pattern
//     ("إل" / "مكيف" literal brand values) found in Phase 3.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import * as fs from "fs";
import { toPoolerDbUrl } from "../../tps-core/pooler-url";

const OUT_DIR = resolve(__dirname, "out");
const TCL_ID = "d47800b5-341c-43dc-88df-64d0df71dd9c";
const HAIER_ID = "ff8b35e4-afcd-43ba-95a6-a06f54c97f52";

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn")) { console.error("NOT PRODUCTION — aborting"); process.exit(1); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // ── (A) TCL + Haier full audit ────────────────────────────────────────────────────────
  console.log("=== (A) TCL + Haier reference canonical audit ===");
  const canon = await c.query(`
    select id, name_en, name_ar, brand, model_number, category, tps_identity_key, is_active,
           data_updated_at, created_at, data_quality_score, identity_confidence, variant_key
    from canonical_products where id = any($1::uuid[])
  `, [[TCL_ID, HAIER_ID]]);

  const obs = await c.query(`
    select npo.canonical_product_id, npo.store_id, npo.raw_name, npo.brand as obs_brand, npo.model_number as obs_model_number,
           npo.identity_key, npo.identity_key_status, npo.confidence, npo.observed_at
    from normalized_product_observations npo
    where npo.canonical_product_id = any($1::uuid[])
    order by npo.canonical_product_id, npo.store_id, npo.observed_at
  `, [[TCL_ID, HAIER_ID]]);

  const storefront = await c.query(`
    select p.canonical_product_id, p.id as storefront_product_id, p.name_en, ps.store_id, ps.product_url, ps.current_price
    from products p join product_stores ps on ps.product_id = p.id
    where p.canonical_product_id = any($1::uuid[])
  `, [[TCL_ID, HAIER_ID]]);

  const byCanon: Record<string, any[]> = {};
  const dedupe: Record<string, any> = {};
  for (const o of obs.rows) {
    const key = o.canonical_product_id + "|" + o.store_id + "|" + o.raw_name;
    if (!dedupe[key] || new Date(o.observed_at) > new Date(dedupe[key].observed_at)) dedupe[key] = o;
  }
  for (const o of Object.values(dedupe)) (byCanon[o.canonical_product_id] ||= []).push(o);

  const tclHaierAudit = canon.rows.map(cp => ({
    ...cp,
    observations: (byCanon[cp.id] || []).sort((a, b) => a.store_id - b.store_id),
    storefront_offers: storefront.rows.filter(s => s.canonical_product_id === cp.id),
  }));
  fs.writeFileSync(resolve(OUT_DIR, "tcl-haier-audit.json"), JSON.stringify(tclHaierAudit, null, 2));
  console.log("wrote tcl-haier-audit.json —", tclHaierAudit.length, "canonicals,", obs.rows.length, "raw observations,", storefront.rows.length, "storefront offers");

  // ── (B) low-confidence GREE AI-Pro/AI-Plus/Cosmo collision scan ────────────────────────
  console.log("\n=== (B) Population-wide GREE series-collapse scan (AC category, low-confidence tier) ===");
  const greeRows = await c.query(`
    select cp.id, cp.name_en, cp.tps_identity_key, cp.is_active,
           npo.store_id, npo.raw_name, npo.identity_key_status, npo.observed_at
    from canonical_products cp
    join normalized_product_observations npo on npo.canonical_product_id = cp.id
    where cp.category = 'air_conditioner' and cp.brand = 'gree'
    order by cp.id, npo.observed_at
  `);
  console.log("GREE AC observation rows scanned:", greeRows.rows.length);

  const byGreeCanon: Record<string, any[]> = {};
  for (const r of greeRows.rows) (byGreeCanon[r.id] ||= []).push(r);

  const AI_PATTERN = /ai[\s-]?pro|ai[\s-]?plus|اي\s?برو|اي\s?بلس|آي\s?بلس|آي\s?برو/i;
  const COSMO_PATTERN = /cosmo|كوزمو/i;

  const affected: any[] = [];
  for (const [canonId, rows] of Object.entries(byGreeCanon)) {
    const hasAiLine = rows.some(r => AI_PATTERN.test(r.raw_name || ""));
    const hasCosmoLine = rows.some(r => COSMO_PATTERN.test(r.raw_name || ""));
    if (hasAiLine && hasCosmoLine) {
      const dedupeKeys = new Set(rows.map(r => r.store_id + "|" + r.raw_name));
      affected.push({
        canonical_id: canonId,
        name_en: rows[0].name_en,
        tps_identity_key: rows[0].tps_identity_key,
        is_active: rows[0].is_active,
        distinct_stores: Array.from(new Set<string>(rows.map(r => r.store_id))),
        distinct_raw_titles: Array.from(dedupeKeys),
        identity_key_status_seen: Array.from(new Set<string>(rows.map(r => r.identity_key_status))),
      });
    }
  }
  console.log("distinct GREE canonicals scanned:", Object.keys(byGreeCanon).length);
  console.log("AFFECTED_CANONICALS (AI-line + Cosmo-line both present):", affected.length);
  for (const a of affected) console.log(" -", a.canonical_id, a.name_en, "| stores:", a.distinct_stores, "| status:", a.identity_key_status_seen);

  const affectedIds = affected.map(a => a.canonical_id);
  let affectedStorefront: any[] = [];
  if (affectedIds.length) {
    const sf = await c.query(`
      select p.canonical_product_id, p.id as storefront_product_id, ps.store_id, ps.current_price
      from products p join product_stores ps on ps.product_id = p.id
      where p.canonical_product_id = any($1::uuid[])
    `, [affectedIds]);
    affectedStorefront = sf.rows;
  }
  console.log("AFFECTED_PRODUCTS (storefront rows pointing at an affected canonical):", affectedStorefront.length);

  fs.writeFileSync(resolve(OUT_DIR, "gree-series-collapse-scan.json"), JSON.stringify({
    rows_scanned: greeRows.rows.length,
    distinct_canonicals_scanned: Object.keys(byGreeCanon).length,
    affected_canonicals: affected,
    affected_storefront_products: affectedStorefront,
  }, null, 2));

  // ── (C) corrupted-brand-token scope (all categories) ────────────────────────────────────
  console.log("\n=== (C) Corrupted-brand-token scope (all categories) ===");
  const brandRows = await c.query(`
    select id, name_en, name_ar, brand, category, tps_identity_key, is_active
    from canonical_products
    where brand = any($1::text[])
  `, [["إل", "مكيف", "ال", "جي"]]);
  console.log("canonicals with a corrupted-token brand value:", brandRows.rows.length);
  for (const b of brandRows.rows) console.log(" -", b.id, "|", b.brand, "|", b.category, "|", b.name_en);

  const brandIds = brandRows.rows.map(b => b.id);
  let brandStorefront: any[] = [];
  let brandObs: any[] = [];
  if (brandIds.length) {
    const sf = await c.query(`select p.canonical_product_id, p.id as storefront_product_id, ps.store_id from products p join product_stores ps on ps.product_id=p.id where p.canonical_product_id = any($1::uuid[])`, [brandIds]);
    brandStorefront = sf.rows;
    const ob = await c.query(`select canonical_product_id, store_id, raw_name from normalized_product_observations where canonical_product_id = any($1::uuid[])`, [brandIds]);
    brandObs = ob.rows;
  }
  console.log("storefront products pointing at a corrupted-brand canonical:", brandStorefront.length);
  console.log("raw observations under a corrupted-brand canonical:", brandObs.length);

  fs.writeFileSync(resolve(OUT_DIR, "brand-corruption-scan.json"), JSON.stringify({
    affected_canonicals: brandRows.rows,
    affected_storefront_products: brandStorefront,
    affected_observations: brandObs,
  }, null, 2));

  await c.end();
  console.log("\nDone.");
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
