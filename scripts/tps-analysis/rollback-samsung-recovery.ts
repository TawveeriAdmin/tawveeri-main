/** Restore derived Samsung identity/visibility from a recovery journal.
 * Dry by default. Immutable raw observations and price history are never deleted.
 * Usage: npx tsx .../rollback-samsung-recovery.ts <apply-journal.json> [--apply]
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { readFileSync, writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { algoliasearch } from 'algoliasearch';
import { toPoolerDbUrl } from '../tps-core/pooler-url';
const { Client } = require('pg');

async function main() {
  const file = process.argv[2];
  const apply = process.argv.includes('--apply');
  const journal = JSON.parse(readFileSync(file, 'utf8'));
  if (!journal.apply || !journal.before?.canonicals || !journal.before?.normalized) throw new Error('An application journal with complete pre-write snapshots is required');
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('vyceqrzttspyycdpojtn')) throw new Error('Unexpected database');
  const source = JSON.parse(readFileSync('docs/evidence/samsung-recovery-source-reconciliation-2026-09-16.json', 'utf8'));
  const sourceKeys = new Set<string>(source.models.filter((m: any) => m.identity && !m.exclusion).map((m: any) => m.identity.key));
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false }, statement_timeout: 30000 });
  await pg.connect();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const result: any = { journal: file, apply, startedAt: new Date().toISOString() };
  const output = `${file}.rollback-${Date.now()}.json`;
  const restore = async (table: string, rows: any[], onConflict: string) => {
    const columns = new Set((await pg.query('select column_name from information_schema.columns where table_schema=$1 and table_name=$2', ['public', table])).rows.map((r: any) => r.column_name));
    const clean = rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => columns.has(key))));
    for (let i = 0; i < clean.length; i += 200) {
      const { error } = await sb.from(table).upsert(clean.slice(i, i + 200), { onConflict });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  };
  try {
    if (apply && !(await pg.query('select pg_try_advisory_lock($1) ok', [8148148])).rows[0].ok) throw new Error('Writer lane busy');
    const current: any[] = (await pg.query("select * from canonical_products where lower(brand)='samsung'")).rows;
    const priorIds = new Set(journal.before.canonicals.map((row: any) => row.id));
    const oldKeys = new Set(journal.plan.moves.map((row: any) => row.oldKey));
    const introduced = current.filter(row => sourceKeys.has(row.tps_identity_key) && !priorIds.has(row.id));
    const restoring = journal.before.canonicals.filter((row: any) => sourceKeys.has(row.tps_identity_key) || oldKeys.has(row.tps_identity_key)
      || journal.plan.modelConflicts.some((conflict: any) => conflict.id === row.id));
    const restoringOffers = journal.before.offers.filter((row: any) => sourceKeys.has(row.identity_key)
      || journal.plan.moves.some((move: any) => move.oldKey === row.identity_key && move.category === row.category && move.store === row.store_id));
    result.plan = { introducedCanonicalIds: introduced.map(row => row.id), restoringCanonicalIds: restoring.map((row: any) => row.id),
      restoringCurrentOffers: restoringOffers.length, restoringLegacyOffers: journal.before.legacy.length };
    result.beforeRollback = { canonicals: current };
    writeFileSync(output, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result.plan));
    if (apply) {
      await pg.query('BEGIN');
      await pg.query(`update canonical_products set is_active=false,model_number=null,
        name_ar=name_ar||' [recovery rollback '||id::text||']' where id=any($1::uuid[])`, [introduced.map(row => row.id)]);
      await pg.query(`update tps_current_offers set status='invalid' where identity_key=any($1::text[]) and store_id in (4,5,6)`, [[...sourceKeys]]);
      await pg.query('COMMIT');
      await restore('canonical_products', restoring, 'id');
      await restore('tps_current_offers', restoringOffers, 'category,identity_key,store_id');
      await restore('normalized_product_observations', journal.before.normalized, 'id');
      await restore('tps_identity_staging', journal.before.staging, 'category,raw_obs_id');
      await pg.query('delete from product_matches where canonical_product_id=any($1::uuid[])', [journal.plan.targetCanonicalIds]);
      await restore('product_matches', journal.before.matches, 'id');
      await pg.query('BEGIN');
      for (const row of journal.before.legacy) {
        await pg.query('update products set canonical_product_id=$2,is_active=$3 where id=$1', [row.product_id, row.canonical_product_id, row.product_active]);
        await pg.query(`update product_stores set current_price=$3,original_price=$4,availability=$5,product_url=$6,last_scraped_at=$7
          where product_id=$1 and store_id=$2`, [row.product_id, row.store_id, row.current_price, row.original_price, row.availability, row.product_url, row.last_scraped_at]);
      }
      await pg.query('COMMIT');
      const snapshot = journal.before.storefront;
      if (snapshot) {
        const app = process.env.ALGOLIA_APP_ID || process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
        const key = process.env.ALGOLIA_ADMIN_KEY;
        if (!app || !key) throw new Error('Samsung storefront rollback index credentials unavailable');
        const client = algoliasearch(app, key);
        const objects = snapshot.priorIndex.filter((row: any) => row?.objectID);
        const existing = new Set(objects.map((row: any) => row.objectID));
        const missing = [...new Set<string>(snapshot.before.map((row: any) => row.product_id))].filter(id => !existing.has(id));
        if (objects.length) await client.saveObjects({ indexName: snapshot.summary.index, objects, waitForTasks: true });
        if (missing.length) await client.deleteObjects({ indexName: snapshot.summary.index, objectIDs: missing, waitForTasks: true });
        result.indexRestored = { objects: objects.length, removed: missing.length };
      }
    }
    result.completedAt = new Date().toISOString();
    writeFileSync(output, JSON.stringify(result, null, 2));
  } catch (error) {
    await pg.query('ROLLBACK').catch(() => {});
    result.error = String(error); writeFileSync(output, JSON.stringify(result, null, 2)); throw error;
  } finally { await pg.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
