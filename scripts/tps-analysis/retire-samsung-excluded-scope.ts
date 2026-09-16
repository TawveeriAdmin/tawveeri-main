/** Reversible serving-state retirement of evidenced non-consumer Samsung models. */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { writeFileSync } from 'fs';
import { toPoolerDbUrl } from '../tps-core/pooler-url';
import { samsungCatalogExclusion } from '../tps-core/samsung-manufacturer-identity';
const { Client } = require('pg');
async function main() {
  const apply = process.argv.includes('--apply');
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false }, statement_timeout: 30000 });
  await pg.connect();
  const evidence: any = { observedAt: new Date().toISOString(), apply };
  const output = `docs/evidence/samsung-recovery-scope-retirement-${Date.now()}.json`;
  try {
    if (apply && !(await pg.query('select pg_try_advisory_lock($1) ok', [8148148])).rows[0].ok) throw new Error('Normalization lane busy');
    const offers = (await pg.query(`select o.*, r.payload->>'sku' model from tps_current_offers o
      join raw_observations r on r.id=o.raw_obs_id where o.store_id=6`)).rows
      .filter((o: any) => samsungCatalogExclusion(o.model || ''));
    const keys = [...new Set(offers.map((o: any) => o.identity_key))];
    const others = (await pg.query(`select identity_key,store_id from tps_current_offers where identity_key=any($1::text[])
      and store_id<>6 and status='valid'`, [keys])).rows;
    if (others.length) throw new Error('Shared merchant identity requires separate scope analysis');
    evidence.before = { offers, canonicals: (await pg.query('select id,tps_identity_key,is_active from canonical_products where tps_identity_key=any($1::text[])', [keys])).rows };
    evidence.reasons = offers.map((o: any) => ({ model: o.model, key: o.identity_key, reason: samsungCatalogExclusion(o.model) }));
    writeFileSync(output, JSON.stringify(evidence, null, 2));
    if (apply) {
      await pg.query('BEGIN');
      for (const o of offers) await pg.query(`update tps_current_offers set status='invalid',
        payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('_consumer_scope_exclusion',$4::text)
        where category=$1 and identity_key=$2 and store_id=6 and raw_obs_id=$3`,
        [o.category,o.identity_key,o.raw_obs_id,samsungCatalogExclusion(o.model)]);
      await pg.query('update canonical_products set is_active=false where tps_identity_key=any($1::text[])', [keys]);
      await pg.query('COMMIT');
    }
    evidence.completedAt = new Date().toISOString();
    evidence.summary = { offers: offers.length, identities: keys.length, sharedMerchantOffers: others.length };
    evidence.rollback = 'Restore each before.offers status/payload by category+identity_key+store_id and each before.canonicals is_active by id under lane 8148148, then rebuild projection. Immutable observations and history were never changed.';
    writeFileSync(output, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify({ output, ...evidence.summary }));
  } catch (error) { await pg.query('ROLLBACK').catch(() => {}); throw error; }
  finally { await pg.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
