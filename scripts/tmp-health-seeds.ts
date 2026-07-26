// TEMP health-audit seed puller (read-only). Deleted after the audit.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "./tps-core/pooler-url";

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn")) { console.error("not production"); process.exit(1); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const rows = async (s: string) => (await c.query(s)).rows;

  const out: Record<string, unknown> = {};
  // Schema truth: what columns does production product_stores actually have?
  out.product_stores_columns = (await rows(`select column_name from information_schema.columns
     where table_schema='public' and table_name='product_stores' order by ordinal_position`)).map((r) => r.column_name);
  out.products_columns = (await rows(`select column_name from information_schema.columns
     where table_schema='public' and table_name='products' order by ordinal_position`)).map((r) => r.column_name);
  out.counts = (await rows(`select
     (select count(*) from products where is_active) products,
     (select count(*) from product_stores) product_stores,
     (select count(*) from stores) stores`))[0];
  // A real product slug (legacy storefront) + how many product_stores it has.
  out.product = (await rows(`select p.slug, count(ps.id) stores from products p
     join product_stores ps on ps.product_id = p.id
     where p.is_active group by p.slug order by count(ps.id) desc limit 1`))[0] ?? null;
  // A real multi-store canonical (for /compare/[key]).
  out.compareKey = (await rows(`select tps_identity_key from canonical_products
     where is_active and coalesce((attributes->>'comparison_eligible')::boolean,false)
     and tps_identity_key is not null limit 1`))[0] ?? null;
  // A real store slug.
  out.store = (await rows(`select slug from stores where slug is not null limit 1`))[0] ?? null;
  // Sample outbound URLs across stores (what click-out actually opens) — only product_url (affiliate_url may not exist).
  out.outbound = await rows(`select s.slug store, ps.product_url
     from product_stores ps join stores s on s.id = ps.store_id
     where ps.product_url is not null order by random() limit 12`).catch((e) => ({ error: String(e).slice(0, 80) }));
  // Offer rows for /go (canonical offers with a resolvable URL).
  out.goOffers = await rows(`select id from product_links limit 5`).catch((e) => ({ error: String(e).slice(0, 80) }));
  console.log(JSON.stringify(out, null, 2));
  await c.end();
})().catch((e) => { console.error("SEED FATAL", e instanceof Error ? e.message : e); process.exit(1); });
