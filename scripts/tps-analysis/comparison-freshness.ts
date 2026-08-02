// scripts/tps-analysis/comparison-freshness.ts
// READ-ONLY. The launch question, answered as one table: how many products are genuinely
// comparable, and HOW FRESH are the prices behind them?
//
// A comparison is only as trustworthy as its STALEST side. A product whose two offers are
// 2 hours and 8 days old is not a fresh comparison — it is a fresh price next to a stale
// one, which is worse than either, because the customer reads the gap as a saving. So the
// age reported per product here is the MAXIMUM age across its offers, never the average
// and never the minimum.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";

(async () => {
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");

  const head = await pg.query(`select count(*)::int products, count(*) filter (where store_count>=2)::int comparable
                               from tps_product_projection`);
  console.log(`projection: ${head.rows[0].products} products · ${head.rows[0].comparable} comparable (>=2 stores)\n`);

  // Age of the newest observation per (canonical, store) — then the WORST of those per canonical.
  const q = `
    with offer_age as (
      select p.tps_identity_key, s.store_id,
             max(s.observed_at) last_seen
      from tps_product_projection p
      join canonical_products c on c.tps_identity_key = p.tps_identity_key and c.is_active
      join tps_identity_staging s on s.identity_key = c.tps_identity_key
      where p.store_count >= 2
      group by 1,2
    ), worst as (
      select tps_identity_key,
             extract(epoch from now() - min(last_seen))/3600.0 worst_age_h,
             extract(epoch from now() - max(last_seen))/3600.0 best_age_h,
             count(*)::int stores
      from offer_age group by 1
    )
    select count(*)::int comparable,
           count(*) filter (where worst_age_h <= 26)::int fresh_26h,
           count(*) filter (where worst_age_h <= 48)::int within_48h,
           count(*) filter (where worst_age_h > 48)::int stale_side,
           round(avg(worst_age_h)::numeric,1) avg_worst_h,
           round((percentile_cont(0.5) within group (order by worst_age_h))::numeric,1) median_worst_h
    from worst`;
  const r = (await pg.query(q)).rows[0] as Record<string, number>;
  console.log("═══ COMPARABLE PRODUCTS BY THE AGE OF THEIR STALEST OFFER ═══");
  console.log(`   measurable comparable products : ${r.comparable}`);
  console.log(`   BOTH sides fresh (<=26h SLO)   : ${r.fresh_26h}   (${(100 * r.fresh_26h / Math.max(1, r.comparable)).toFixed(1)}%)`);
  console.log(`   both sides within 48h          : ${r.within_48h}   (${(100 * r.within_48h / Math.max(1, r.comparable)).toFixed(1)}%)`);
  console.log(`   at least one STALE side (>48h) : ${r.stale_side}   (${(100 * r.stale_side / Math.max(1, r.comparable)).toFixed(1)}%)`);
  console.log(`   median stalest side            : ${r.median_worst_h}h · mean ${r.avg_worst_h}h`);

  console.log("\n═══ WHICH RETAILERS CARRY THE STALE SIDE ═══");
  const by = await pg.query(`
    with offer_age as (
      select p.tps_identity_key, s.store_id, max(s.observed_at) last_seen
      from tps_product_projection p
      join canonical_products c on c.tps_identity_key = p.tps_identity_key and c.is_active
      join tps_identity_staging s on s.identity_key = c.tps_identity_key
      where p.store_count >= 2 group by 1,2
    )
    select st.slug, count(*)::int offers_in_comparisons,
           round(avg(extract(epoch from now()-last_seen)/3600.0)::numeric,1) avg_age_h,
           count(*) filter (where now()-last_seen > interval '48 hours')::int stale_offers
    from offer_age a join stores st on st.id = a.store_id
    group by 1 order by 2 desc`);
  for (const x of by.rows as any[]) {
    const flag = Number(x.avg_age_h) > 48 ? "STALE" : Number(x.avg_age_h) > 26 ? "warn " : "fresh";
    console.log(`   [${flag}] ${String(x.slug).padEnd(14)} offers_in_comparisons=${String(x.offers_in_comparisons).padStart(5)}  avg_age=${String(x.avg_age_h).padStart(7)}h  stale=${x.stale_offers}`);
  }
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
