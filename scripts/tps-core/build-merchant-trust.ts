// scripts/tps-core/build-merchant-trust.ts
// Materialize per-store Merchant Trust profiles into tps_merchant_trust. Aggregates
// (deterministically) discount honesty from tps_listing_price_facts + real price
// competitiveness from price_history over corroborated products + coverage, then
// applies the tested pure engine (computeStoreTrust). Idempotent; read-only sources.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { readFileSync } from "fs";
import { Client } from "pg";
import { assertFingerprint } from "./tps-batch";
import { computeStoreTrust } from "../../src/lib/intelligence/merchant-trust";

// price_history uses Arabic store labels; map them to canonical store_id.
const NAME_TO_ID: Record<string, number> = { "جرير": 1, "أمازون": 2, "نون": 3, "اكسترا": 4, "المنيع": 5 };

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect(); await pg.query("set statement_timeout = 0");
  await pg.query(readFileSync(resolve(process.cwd(), "scripts/database/knowledge-db/023_merchant_trust.sql"), "utf8"));

  const stores = await pg.query(`select id, name from stores order by id`);
  // discount honesty per store_id
  const dh = await pg.query(`
    select store_id, count(*)::int facts,
           count(*) filter (where verdict='inflated_reference')::int inflated,
           count(*) filter (where verdict='verified_drop')::int verified
    from tps_listing_price_facts group by store_id`);
  const honesty = new Map<number, { facts: number; inflated: number; verified: number }>();
  for (const r of dh.rows) honesty.set(Number(r.store_id), { facts: r.facts, inflated: r.inflated, verified: r.verified });

  // price competitiveness: cheapest-store share on corroborated products
  const pc = await pg.query(`
    with best as (
      select ph.canonical_product_id, ph.store_name, ph.price::numeric,
        row_number() over (partition by ph.canonical_product_id order by ph.price::numeric asc) rn
      from price_history ph join tps_product_projection pr on pr.canonical_id=ph.canonical_product_id and pr.has_comparison)
    select store_name, count(*) filter (where rn=1)::int cheapest, count(*)::int appearances
    from best group by store_name`);
  const comp = new Map<number, { cheapest: number; appearances: number }>();
  for (const r of pc.rows) { const id = NAME_TO_ID[r.store_name as string]; if (id) comp.set(id, { cheapest: r.cheapest, appearances: r.appearances }); }

  // distinct products per store from staging
  const dp = await pg.query(`select store_id, count(distinct identity_key)::int n from tps_identity_staging where identity_key is not null group by store_id`);
  const distinct = new Map<number, number>();
  for (const r of dp.rows) distinct.set(Number(r.store_id), r.n);

  const rows: unknown[][] = [];
  for (const s of stores.rows) {
    const id = Number(s.id);
    const h = honesty.get(id) ?? { facts: 0, inflated: 0, verified: 0 };
    const c = comp.get(id) ?? { cheapest: 0, appearances: 0 };
    const t = computeStoreTrust({
      store_id: id, store_name: s.name, facts_analyzed: h.facts,
      discount_inflated: h.inflated, discount_verified: h.verified,
      cheapest_count: c.cheapest, corroborated_appearances: c.appearances,
      distinct_products: distinct.get(id) ?? 0,
    });
    rows.push([id, s.name, t.discount_behavior, t.evaluable_claims, t.discount_inflation_pct, t.verified_deals, t.price_competitiveness_pct, t.distinct_products, t.headline.ar, t.headline.en]);
    console.log(`  ${String(s.name).padEnd(20)} behavior=${t.discount_behavior} inflation=${t.discount_inflation_pct ?? '—'}% cheapest=${t.price_competitiveness_pct ?? '—'}% products=${t.distinct_products}`);
  }
  const vals: string[] = []; const params: unknown[] = [];
  rows.forEach((r, j) => { const b = j * 10; vals.push(`(${Array.from({ length: 10 }, (_, k) => `$${b + k + 1}`).join(",")}, now())`); params.push(...r); });
  await pg.query(
    `insert into tps_merchant_trust (store_id, store_name, discount_behavior, evaluable_claims, discount_inflation_pct, verified_deals, price_competitiveness_pct, distinct_products, headline_ar, headline_en, updated_at)
     values ${vals.join(",")}
     on conflict (store_id) do update set store_name=excluded.store_name, discount_behavior=excluded.discount_behavior, evaluable_claims=excluded.evaluable_claims, discount_inflation_pct=excluded.discount_inflation_pct, verified_deals=excluded.verified_deals, price_competitiveness_pct=excluded.price_competitiveness_pct, distinct_products=excluded.distinct_products, headline_ar=excluded.headline_ar, headline_en=excluded.headline_en, updated_at=now()`,
    params);
  console.log(`\nmaterialized ${rows.length} merchant-trust profiles`);
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
