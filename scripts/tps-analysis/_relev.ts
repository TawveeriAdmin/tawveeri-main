import { config } from "dotenv"; import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import pg from "pg"; import { toPoolerDbUrl } from "../tps-core/pooler-url";
(async () => {
  const c = new pg.Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const names = ['الشتاء والصيف','swsg','8'];
  const { rows } = await c.query(
    `with mine as (select ph.canonical_product_id cid, count(distinct ph.store_name) n, bool_or(ph.store_name = any($1)) has_me
       from price_history ph where ph.canonical_product_id is not null group by 1),
     their_brands as (select distinct lower(cp.brand) b from canonical_products cp join price_history ph on ph.canonical_product_id=cp.id
       where ph.store_name = any($1) and cp.brand is not null)
     select cp.brand, cp.model_number, cp.name_en from mine join canonical_products cp on cp.id=mine.cid
     where mine.n=1 and not mine.has_me and cp.is_active and cp.brand is not null
       and lower(cp.brand) in (select b from their_brands) and cp.name_en is not null and length(cp.name_en)>8
     order by md5(cp.id::text) limit 6`, [names]);
  await c.end();
  const { magentoSearch } = await import("../../src/lib/providers/sourcing/magento-graphql-adapter");
  for (const t of rows as any[]) {
    const seed = [t.brand, t.model_number || t.name_en.split(/[,|(]/)[0]].join(' ').replace(/\s+/g,' ').trim().slice(0,90);
    const hits = await magentoSearch("https://swsg.co", seed, 2);
    console.log(`\nSEED: ${seed.slice(0,80)}`);
    for (const h of hits) console.log(`   HIT: ${String((h as any).name_en).slice(0,80)}  @ ${(h as any).current_price}`);
    if (!hits.length) console.log("   (no hits)");
  }
})();
