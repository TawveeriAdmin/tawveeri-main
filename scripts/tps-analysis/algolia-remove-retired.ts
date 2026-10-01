// scripts/tps-analysis/algolia-remove-retired.ts — ADR-399 (F-007)
//
// The storefront search reads the `products` Algolia index; `rebuild-products-index.ts` only
// indexes `is_active` products, but a product retired AFTER the last rebuild stays in the index
// and the search route maps the hit straight to `/products/<id>` — a 404 for the shopper.
// Found live 2026-10-01: a product retired by the ADR-397 de-duplication (TCL 55P61L) still came
// back from POST /api/search. This removes every inactive product's object from the index.
//
//   DRY_RUN=true  npx tsx scripts/tps-analysis/algolia-remove-retired.ts   (default: report only)
//   DRY_RUN=false npx tsx scripts/tps-analysis/algolia-remove-retired.ts   (delete)
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import { algoliasearch } from 'algoliasearch';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require('pg') as { Client: new (cfg: object) => { connect(): Promise<void>; query(sql: string): Promise<{ rows: { id: string }[] }>; end(): Promise<void> } };
const { toPoolerDbUrl } = require('../tps-core/pooler-url') as { toPoolerDbUrl: (raw: string) => string };

const DRY_RUN = process.env.DRY_RUN !== 'false';
const APP_ID = process.env.ALGOLIA_APP_ID || process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || '';
const ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY || '';
const INDEX = process.env.ALGOLIA_INDEX_NAME || 'products';

async function main() {
  if (!APP_ID || !ADMIN_KEY) throw new Error('missing ALGOLIA_APP_ID / ALGOLIA_ADMIN_KEY');
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl || !/vyceqrzttspyycdpojtn/.test(dbUrl)) throw new Error('refusing: SUPABASE_DB_URL is not the production project');
  const pg = new Client({ connectionString: toPoolerDbUrl(dbUrl), ssl: { rejectUnauthorized: false }, statement_timeout: 60_000 });
  await pg.connect();
  const inactive = new Set((await pg.query(`select id::text from products where is_active = false`)).rows.map((r) => r.id));
  await pg.end();

  const client = algoliasearch(APP_ID, ADMIN_KEY);
  const present: string[] = [];
  let scanned = 0;
  await client.browseObjects({
    indexName: INDEX,
    browseParams: { attributesToRetrieve: ['objectID'], hitsPerPage: 1000 },
    aggregator: (res: { hits: Array<{ objectID: string }> }) => { for (const h of res.hits) { scanned++; if (inactive.has(h.objectID)) present.push(h.objectID); } },
  });
  console.log(JSON.stringify({ index: INDEX, dryRun: DRY_RUN, scanned, inactiveProducts: inactive.size, retiredStillIndexed: present.length }));
  if (DRY_RUN || !present.length) return;
  for (let i = 0; i < present.length; i += 1000) {
    await client.deleteObjects({ indexName: INDEX, objectIDs: present.slice(i, i + 1000) });
  }
  console.log(JSON.stringify({ deleted: present.length }));
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
