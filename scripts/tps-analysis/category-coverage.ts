// scripts/tps-analysis/category-coverage.ts
// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY-COVERAGE ANALYZER — the acquisition compass (read-only).
//
// The acquisition KPI is comparison QUALITY per category, not store count. This ranks every
// category by how well it is covered — canonicals, how many are COMPARABLE (≥2 distinct
// stores, measured from normalized_product_observations — the reliable link, immune to the
// mixed-type attributes.stores array), the comparison rate, and depth. Weak categories (few
// comparables / low rate) are where a specialist retailer adds the most value; saturated ones
// are deprioritized. Guides "onboard against category gaps". Writes nothing.
//   npx tsx scripts/tps-analysis/category-coverage.ts
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";

(async () => {
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const rows = (await c.query(`
      with sc as (
        select canonical_product_id, count(distinct store_id) stores
          from normalized_product_observations where canonical_product_id is not null group by 1)
      select cp.category,
             count(*) canonicals,
             count(*) filter (where coalesce(sc.stores,1) >= 2) comparable,
             count(*) filter (where coalesce(sc.stores,1) >= 3) depth3,
             coalesce(max(sc.stores),1) max_depth
        from canonical_products cp
        left join sc on sc.canonical_product_id = cp.id
       where cp.is_active
       group by cp.category`)).rows as { category: string; canonicals: string; comparable: string; depth3: string; max_depth: string }[];

    const data = rows.map((r) => ({
      cat: r.category, canon: +r.canonicals, cmp: +r.comparable, d3: +r.depth3, depth: +r.max_depth,
      rate: +r.canonicals ? Math.round((+r.comparable / +r.canonicals) * 100) : 0,
    })).sort((a, b) => b.cmp - a.cmp);

    const tot = data.reduce((a, d) => ({ canon: a.canon + d.canon, cmp: a.cmp + d.cmp }), { canon: 0, cmp: 0 });
    console.log(`\n◆ CATEGORY COVERAGE — ${tot.cmp} comparable / ${tot.canon} canonicals (${Math.round(tot.cmp / tot.canon * 100)}%) across ${data.length} categories\n`);
    console.log("  category            canon   cmp  rate  3+store  maxDepth   signal");
    for (const d of data) {
      const signal = d.cmp === 0 ? "❌ NO COMPARISONS" : d.cmp < 15 ? "⚠ WEAK — prioritize" : d.rate < 15 ? "◑ shallow (single-store heavy)" : "✓ ok";
      console.log(`  ${d.cat.padEnd(20)}${String(d.canon).padStart(5)}${String(d.cmp).padStart(6)}${String(d.rate + "%").padStart(6)}${String(d.d3).padStart(8)}${String(d.depth).padStart(9)}   ${signal}`);
    }
    console.log(`\n→ Onboard specialists into ❌/⚠ categories first; deprioritize ✓ saturated ones.\n`);
  } finally { await c.end(); }
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
