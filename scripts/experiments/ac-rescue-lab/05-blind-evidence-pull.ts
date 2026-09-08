// AC Rescue Lab — Phase 2 Step: pull raw independent evidence (URL, raw scraped title,
// spec payload) for every Amazon AC product and every trusted candidate that appears in
// Run A's 26 eligible cases. READ-ONLY (SELECT only against production).
//
// PURPOSE: ground-truth labeling must NOT be derived from V1's own fingerprint output
// (that would be circular — V1's fingerprint IS the thing being validated). This script
// pulls evidence V1 never used for its decision (literal URLs, raw scraped titles from
// EVERY store observation, not just the one used for identity_key) so ground truth can be
// established independently, then compared against V1's frozen classification afterward.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import * as fs from "fs";
import { toPoolerDbUrl } from "../../tps-core/pooler-url";

const OUT_DIR = resolve(__dirname, "out");
const classified = JSON.parse(fs.readFileSync(resolve(OUT_DIR, "run-A-classified.json"), "utf-8"));

const amazonIds: string[] = classified.map((r: any) => r.amazon_id);
const trustedIds: string[] = Array.from(new Set<string>(classified.flatMap((r: any) => (r.candidates || []).map((c: any) => c.trusted_id))));

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn")) { console.error("NOT PRODUCTION — aborting"); process.exit(1); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log("Pulling Amazon-side raw evidence (url + raw title + specs) for", amazonIds.length, "products...");
  const amazonEvidence = await c.query(`
    select p.id as product_id, p.name_en, ps.store_id, ps.product_url as url,
           ro.raw_name, ro.payload->'specifications' as specs, ro.scraped_at
    from products p
    join product_stores ps on ps.product_id = p.id and ps.store_id = 2
    left join raw_observations ro on ro.store_id = 2 and ro.raw_name = p.name_en
    where p.id = any($1::uuid[])
    order by p.id, ro.scraped_at desc
  `, [amazonIds]);

  console.log("Pulling trusted-side raw evidence (ALL non-Amazon store observations) for", trustedIds.length, "canonicals...");
  const trustedEvidence = await c.query(`
    select cp.id as canonical_id, cp.name_en as canonical_name, cp.model_number as canonical_model_number,
           npo.store_id, npo.raw_name, npo.normalized_payload, npo.observed_at
    from canonical_products cp
    join normalized_product_observations npo on npo.canonical_product_id = cp.id
    where cp.id = any($1::uuid[]) and npo.store_id != '2'
    order by cp.id, npo.store_id
  `, [trustedIds]);

  console.log("Pulling trusted-side store URLs where available (products/product_stores, if the canonical is also storefront-linked)...");
  const trustedUrls = await c.query(`
    select p.canonical_product_id as canonical_id, ps.store_id, ps.product_url as url, p.name_en, p.name_ar
    from products p
    join product_stores ps on ps.product_id = p.id
    where p.canonical_product_id = any($1::uuid[]) and ps.store_id != 2
  `, [trustedIds]);

  fs.writeFileSync(resolve(OUT_DIR, "blind-amazon-evidence.json"), JSON.stringify(amazonEvidence.rows, null, 2));
  fs.writeFileSync(resolve(OUT_DIR, "blind-trusted-evidence.json"), JSON.stringify(trustedEvidence.rows, null, 2));
  fs.writeFileSync(resolve(OUT_DIR, "blind-trusted-urls.json"), JSON.stringify(trustedUrls.rows, null, 2));

  console.log("amazon evidence rows:", amazonEvidence.rows.length);
  console.log("trusted evidence rows:", trustedEvidence.rows.length);
  console.log("trusted url rows:", trustedUrls.rows.length);

  await c.end();
  console.log("Wrote blind-amazon-evidence.json, blind-trusted-evidence.json, blind-trusted-urls.json");
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
