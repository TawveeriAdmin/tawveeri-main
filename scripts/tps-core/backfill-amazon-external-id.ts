// scripts/tps-core/backfill-amazon-external-id.ts
//
// ADR-396 one-off: stamp `product_stores.external_id = ASIN` on amazon rows that were created
// by the adapter route without one (measured 2026-10-01: 4,993 of 12,482 rows). Without it the
// worker's identity lookup (`findExistingProductByStoreIdentity`, external_id first) never
// matched those rows and every re-sighting created a duplicate product.
//
// Idempotent, bounded to store 2, touches only rows whose external_id IS NULL and whose URL
// carries an ASIN. `--dry` (default) prints the count; `--apply` writes, in one statement.
//
//   npx tsx scripts/tps-core/backfill-amazon-external-id.ts --dry
//   npx tsx scripts/tps-core/backfill-amazon-external-id.ts --apply
require('dotenv').config({ path: '.env.local' });
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require('pg') as { Client: new (cfg: object) => { connect(): Promise<void>; query(sql: string): Promise<{ rows: { n: number }[]; rowCount: number | null }>; end(): Promise<void> } };
const { toPoolerDbUrl } = require('./pooler-url') as { toPoolerDbUrl: (raw: string) => string };

async function main() {
  const apply = process.argv.includes('--apply');
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error('SUPABASE_DB_URL is required');
  if (!/vyceqrzttspyycdpojtn/.test(url)) throw new Error('refusing: SUPABASE_DB_URL is not the production project');
  const c = new Client({ connectionString: toPoolerDbUrl(url), ssl: { rejectUnauthorized: false }, statement_timeout: 120_000 });
  await c.connect();
  const where = `store_id = 2 AND external_id IS NULL AND product_url ~ '/dp/[A-Z0-9]{10}'`;
  const { rows: [before] } = await c.query(`select count(*)::int n from product_stores where ${where}`);
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry', candidates: before.n }));
  if (!apply) { await c.end(); return; }
  await c.query('BEGIN');
  const r = await c.query(`update product_stores set external_id = upper(substring(product_url from '/dp/([A-Za-z0-9]{10})')) where ${where}`);
  await c.query('COMMIT');
  const { rows: [after] } = await c.query(`select count(*)::int n from product_stores where ${where}`);
  console.log(JSON.stringify({ updated: r.rowCount, remaining_null: after.n }));
  await c.end();
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
