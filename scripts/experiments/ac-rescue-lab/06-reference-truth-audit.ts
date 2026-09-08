// AC Rescue Lab — Phase 3: reference-truth audit. READ-ONLY (SELECT only).
// Pulls full evidence for (a) all 20 valid-tier AC canonicals and (b) the 2 canonicals
// identified in Phase 2 (ADR-320) as contamination candidates, so ground truth can be
// established per-canonical from raw observation history, timestamps, and any linked
// storefront offers — independent of the tps_identity_key the canonical currently carries.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import * as fs from "fs";
import { toPoolerDbUrl } from "../../tps-core/pooler-url";

const OUT_DIR = resolve(__dirname, "out");
const trusted = JSON.parse(fs.readFileSync(resolve(OUT_DIR, "trusted-fingerprints.json"), "utf-8"));
const validTierIds: string[] = trusted.filter((t: any) => (t.tier_status || "").includes("valid")).map((t: any) => t.id);
const contaminationCandidateIds = ["23b80f80-fd8c-4962-b061-a916e5f4eaa0", "39657761-7015-40a7-8a26-c4f4fab68f93"];
const allIds = Array.from(new Set<string>([...validTierIds, ...contaminationCandidateIds]));

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn")) { console.error("NOT PRODUCTION — aborting"); process.exit(1); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log("Auditing", allIds.length, "canonicals (", validTierIds.length, "valid-tier +", contaminationCandidateIds.length, "known contamination candidates, deduped)...");

  const canon = await c.query(`
    select id, name_en, name_ar, brand, model_number, category, tps_identity_key, is_active,
           data_updated_at, created_at, data_quality_score, identity_confidence, variant_key
    from canonical_products where id = any($1::uuid[])
  `, [allIds]);

  const obs = await c.query(`
    select npo.canonical_product_id, npo.store_id, npo.raw_name, npo.brand as obs_brand, npo.model_number as obs_model_number,
           npo.identity_key, npo.identity_key_status, npo.confidence, npo.normalized_payload,
           npo.observed_at, npo.normalizer_version, npo.plugin_version, npo.source_table, npo.source_record_id
    from normalized_product_observations npo
    where npo.canonical_product_id = any($1::uuid[])
    order by npo.canonical_product_id, npo.store_id, npo.observed_at
  `, [allIds]);

  const pm = await c.query(`
    select pm.canonical_product_id, pm.raw_observation_id, pm.match_method, pm.confidence as match_confidence,
           pm.is_verified, pm.matched_at
    from product_matches pm
    where pm.canonical_product_id = any($1::uuid[])
    order by pm.canonical_product_id, pm.matched_at
  `, [allIds]);

  const storefront = await c.query(`
    select p.canonical_product_id, p.id as storefront_product_id, p.name_en, p.name_ar, ps.store_id, ps.product_url, ps.current_price
    from products p join product_stores ps on ps.product_id = p.id
    where p.canonical_product_id = any($1::uuid[])
  `, [allIds]);

  const priceHist = await c.query(`
    select canonical_product_id, store_id, store_name, price, observed_at
    from price_history
    where canonical_product_id = any($1::uuid[])
    order by canonical_product_id, observed_at
  `, [allIds]);

  fs.writeFileSync(resolve(OUT_DIR, "audit-canonicals.json"), JSON.stringify(canon.rows, null, 2));
  fs.writeFileSync(resolve(OUT_DIR, "audit-observations.json"), JSON.stringify(obs.rows, null, 2));
  fs.writeFileSync(resolve(OUT_DIR, "audit-product-matches.json"), JSON.stringify(pm.rows, null, 2));
  fs.writeFileSync(resolve(OUT_DIR, "audit-storefront.json"), JSON.stringify(storefront.rows, null, 2));
  fs.writeFileSync(resolve(OUT_DIR, "audit-price-history.json"), JSON.stringify(priceHist.rows, null, 2));

  console.log("canonicals:", canon.rows.length);
  console.log("observations:", obs.rows.length);
  console.log("product_matches:", pm.rows.length);
  console.log("storefront offers:", storefront.rows.length);
  console.log("price_history rows:", priceHist.rows.length);

  await c.end();
  console.log("Wrote audit-*.json");
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
