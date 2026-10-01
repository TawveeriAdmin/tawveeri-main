// scripts/tps-core/dedupe-amazon-rows.ts — ADR-397 (trial first, then full)
//
// One ASIN = one listing. Amazon's storefront rows were duplicated two ways:
//   (a) the same product_id holding many rows (store_name NULL rows never collide on the
//       (product_id, store_name) unique index) — 356 products, 5,616 extra rows, 5,395 of them
//       referenced by nothing (no price_history, outbound_clicks, transactions, notifications);
//   (b) the same ASIN under several products (name-matched variants) — 508 "loser" products,
//       0 wishlists / alerts / clicks / transactions on them.
//
// What this does, reversibly:
//   (a) deletes ONLY unreferenced extra rows; the survivor per product is the row with the most
//       price_history, then the most recent credible write. Every deleted row is written in full
//       to the backup JSON first (restore = re-insert).
//   (b) sets products.is_active = false on loser products (search/catalog filter on is_active);
//       restore = flip back. Rows, history and canonical links are untouched.
// Never touches price_history / raw_observations (append-only, Constitution).
//
//   npx tsx scripts/tps-core/dedupe-amazon-rows.ts --dry  --top 30
//   npx tsx scripts/tps-core/dedupe-amazon-rows.ts --apply --top 30 --out docs/evidence/adr397-amazon-dedupe-trial.json
//   npx tsx scripts/tps-core/dedupe-amazon-rows.ts --apply --all  --out docs/evidence/adr397-amazon-dedupe-full.json
import fs from 'fs';
require('dotenv').config({ path: '.env.local' });
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require('pg') as { Client: new (cfg: object) => { connect(): Promise<void>; query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>; end(): Promise<void> } };
const { toPoolerDbUrl } = require('./pooler-url') as { toPoolerDbUrl: (raw: string) => string };

const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const APPLY = process.argv.includes('--apply');
const ALL = process.argv.includes('--all');
const TOP = parseInt(arg('--top') || '30', 10);
const OUT = arg('--out') || `docs/evidence/adr397-amazon-dedupe-${ALL ? 'full' : 'trial'}-${new Date().toISOString().slice(0, 10)}.json`;

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error('SUPABASE_DB_URL is required');
  if (!/vyceqrzttspyycdpojtn/.test(url)) throw new Error('refusing: not the production project');
  const c = new Client({ connectionString: toPoolerDbUrl(url), ssl: { rejectUnauthorized: false }, statement_timeout: 300_000 });
  await c.connect();

  // ── scope: ASINs ──────────────────────────────────────────────────────────
  const scopeSql = ALL
    ? `select distinct substring(product_url from '/dp/([A-Z0-9]{10})') asin from product_stores where store_id = 2 and substring(product_url from '/dp/([A-Z0-9]{10})') is not null`
    : `select asin from (select substring(product_url from '/dp/([A-Z0-9]{10})') asin, count(*) n from product_stores where store_id = 2 group by 1 having substring(product_url from '/dp/([A-Z0-9]{10})') is not null and count(*) > 1 order by n desc limit ${TOP}) z`;
  const asins = (await c.query(scopeSql)).rows.map((r) => String(r.asin));

  // ── (a) extra rows per product (within scope), unreferenced only ──────────
  const extras = (await c.query(`
    with r as (
      select ps.*, substring(ps.product_url from '/dp/([A-Z0-9]{10})') asin,
        (select count(*) from price_history h where h.product_store_id::text = ps.id::text) hist,
        (select count(*) from outbound_clicks o where o.product_store_id = ps.id) clicks,
        (select count(*) from transactions t where t.product_store_id = ps.id) tx,
        (select count(*) from notifications n where n.product_store_id = ps.id) notif
      from product_stores ps
      where ps.store_id = 2 and ps.product_id in (
        select product_id from product_stores where store_id = 2
          and substring(product_url from '/dp/([A-Z0-9]{10})') = any($1) group by 1 having count(*) > 1)
    ), ranked as (select *, row_number() over (partition by product_id order by hist desc, updated_at desc nulls last, id) rk from r)
    select * from ranked where rk > 1 and hist = 0 and clicks = 0 and tx = 0 and notif = 0`, [asins])).rows;

  // ── (b) loser products: same ASIN under 2+ products, within scope ─────────
  const losers = (await c.query(`
    with r as (select substring(ps.product_url from '/dp/([A-Z0-9]{10})') asin, ps.product_id, ps.id sid from product_stores ps where ps.store_id = 2),
    ph as (select product_store_id::text sid, count(*) n from price_history where store_id = 2 group by 1),
    pp as (select r.asin, r.product_id, sum(coalesce(ph.n, 0)) hist, count(*) rows from r left join ph on ph.sid = r.sid::text where r.asin = any($1) group by 1, 2),
    ranked as (select *, row_number() over (partition by asin order by hist desc, rows desc, product_id) rk, count(*) over (partition by asin) np from pp)
    select asin, product_id, hist, rows from ranked where rk > 1 and np > 1
      and not exists (select 1 from user_wishlists w where w.product_id = ranked.product_id)
      and not exists (select 1 from price_alerts a where a.product_id = ranked.product_id)
      and not exists (select 1 from outbound_clicks o join product_stores ps on ps.id = o.product_store_id where ps.product_id = ranked.product_id)
      and not exists (select 1 from transactions t join product_stores ps on ps.id = t.product_store_id where ps.product_id = ranked.product_id)`, [asins])).rows;

  const plan = { mode: APPLY ? 'apply' : 'dry', scope: ALL ? 'all' : `top-${TOP}`, asins: asins.length, extra_rows_to_delete: extras.length, loser_products_to_deactivate: losers.length };
  console.log(JSON.stringify(plan));
  if (!APPLY) { await c.end(); return; }

  // backup FIRST, then write
  fs.mkdirSync(require('path').dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), plan, deleted_rows: extras, deactivated_products: losers }, null, 1));
  await c.query('BEGIN');
  const del = extras.length ? await c.query(`delete from product_stores where id = any($1::uuid[])`, [extras.map((e) => e.id)]) : { rowCount: 0 };
  const dea = losers.length ? await c.query(`update products set is_active = false where id = any($1::uuid[]) and is_active = true`, [losers.map((l) => l.product_id)]) : { rowCount: 0 };
  await c.query('COMMIT');
  console.log(JSON.stringify({ deleted: del.rowCount, deactivated: dea.rowCount, backup: OUT }));
  await c.end();
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
