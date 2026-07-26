// scripts/tps-analysis/store-impact.ts
// ─────────────────────────────────────────────────────────────────────────────
// STORE-IMPACT ANALYZER — product-first onboarding measurement (read-only).
//
// Answers the only question that matters under the product-intelligence mandate: what did
// this store (or set of stores) contribute to the KNOWLEDGE GRAPH? Measures — via
// normalized_product_observations (the reliable store link) — realization progress and:
//   • products ingested / normalized              (realization)
//   • canonicals it participates in               (breadth)
//   • NET-NEW comparisons it ENABLED              (comparable now, but NOT without this set —
//                                                  i.e. the store is necessary for the compare)
//   • DEPTH added                                 (comparisons where it is the 3rd+ store)
//   • category + brand breakdown of the net-new   (where the value landed)
//   • customer savings surfaced by the net-new    (max−min price across the compared offers)
// A store with high "net-new + depth" earned its onboarding; a store with ~0 did not.
//   npx tsx scripts/tps-analysis/store-impact.ts <storeId> [storeId …]
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";

(async () => {
  const ids = process.argv.slice(2).map((s) => s.trim()).filter((s) => /^\d+$/.test(s));
  if (!ids.length) { console.error("usage: store-impact <storeId> [storeId …]"); process.exit(1); }
  const idList = ids.map((i) => `'${i}'`).join(",");
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = async (sql: string) => (await c.query(sql)).rows;
  try {
    // Realization progress (raw vs normalized) per store.
    const real = await q(`
      select r.store_id,
             (select count(*) from raw_observations x where x.store_id=r.store_id) raw,
             (select count(*) from normalized_product_observations n where n.store_id=r.store_id::text) normalized
        from (select distinct store_id from raw_observations where store_id in (${idList})) r order by r.store_id`);
    console.log(`\n◆ STORE IMPACT — stores [${ids.join(", ")}]\n`);
    console.log("  realization:");
    for (const s of real) console.log(`    store ${String(s.store_id).padStart(3)}: ${s.normalized}/${s.raw} normalized`);

    // Per-canonical store counts: total, and excluding the target set.
    const impact = (await q(`
      with sc as (select canonical_product_id cid, count(distinct store_id) st from normalized_product_observations where canonical_product_id is not null group by 1),
           others as (select canonical_product_id cid, count(distinct store_id) st from normalized_product_observations where canonical_product_id is not null and store_id not in (${idList}) group by 1),
           mine as (select distinct canonical_product_id cid from normalized_product_observations where store_id in (${idList}) and canonical_product_id is not null)
      select
        count(*) canonicals_touched,
        count(*) filter (where sc.st>=2) comparable_touched,
        count(*) filter (where sc.st>=2 and coalesce(o.st,0)<2) net_new_comparisons,
        count(*) filter (where sc.st>=2 and coalesce(o.st,0)>=2) depth_added
      from mine
      join sc on sc.cid=mine.cid
      left join others o on o.cid=mine.cid`))[0];
    console.log(`\n  canonicals touched:        ${impact.canonicals_touched}`);
    console.log(`  comparable participated:   ${impact.comparable_touched}`);
    console.log(`  ★ NET-NEW comparisons:     ${impact.net_new_comparisons}  (would not exist without this set)`);
    console.log(`  ★ depth added (3rd+ store): ${impact.depth_added}`);

    // Category breakdown of the net-new comparisons + savings.
    const byCat = await q(`
      with sc as (select canonical_product_id cid, count(distinct store_id) st from normalized_product_observations where canonical_product_id is not null group by 1),
           others as (select canonical_product_id cid, count(distinct store_id) st from normalized_product_observations where canonical_product_id is not null and store_id not in (${idList}) group by 1),
           mine as (select distinct canonical_product_id cid from normalized_product_observations where store_id in (${idList}) and canonical_product_id is not null),
           netnew as (select mine.cid from mine join sc on sc.cid=mine.cid left join others o on o.cid=mine.cid where sc.st>=2 and coalesce(o.st,0)<2)
      select cp.category, count(*) net_new,
             sum(gr.mx-gr.mn) filter (where gr.mx>gr.mn) total_savings
        from netnew join canonical_products cp on cp.id=netnew.cid
        left join (select canonical_product_id cid, max(price::numeric) mx, min(price::numeric) mn from price_history group by 1) gr on gr.cid=netnew.cid
       group by cp.category order by 2 desc`);
    console.log(`\n  net-new comparisons by category (+ customer savings surfaced):`);
    for (const r of byCat) console.log(`    ${String(r.category).padEnd(18)} ${String(r.net_new).padStart(3)}   savings≈ ${r.total_savings ? Math.round(r.total_savings).toLocaleString() + " SAR" : "—"}`);
    console.log("");
  } finally { await c.end(); }
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
