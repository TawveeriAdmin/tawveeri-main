import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { readFileSync, writeFileSync } from 'fs';
import { toPoolerDbUrl } from '../tps-core/pooler-url';
const { Client } = require('pg');
async function main() {
  const model = process.argv[2] || 'SM-R420NZAAMEA';
  const phase = process.argv.find(a => a.startsWith('--phase='))?.slice(8);
  if (phase && !/^[a-z-]+$/.test(phase)) throw new Error('Invalid phase');
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  try {
    const canonical = (await pg.query('select * from canonical_products where tps_identity_key=$1', [`samsung|MODEL:${model}`])).rows[0];
    const evidence: any = { measuredAt: new Date().toISOString(), model, canonical };
    evidence.offers = (await pg.query('select * from tps_current_offers where identity_key=$1', [canonical.tps_identity_key])).rows;
    evidence.history = (await pg.query('select * from price_history where canonical_product_id=$1 order by observed_at desc limit 30', [canonical.id])).rows;
    evidence.observations = (await pg.query('select id,store_id,observed_at,normalized_payload from normalized_product_observations where canonical_product_id=$1 order by observed_at desc limit 30', [canonical.id])).rows;
    evidence.delists = (await pg.query('select * from tps_offer_delist_signals where canonical_product_id=$1', [canonical.id])).rows;
    const source = JSON.parse(readFileSync('docs/evidence/samsung-recovery-source-reconciliation-2026-09-16.json', 'utf8'));
    const keys = source.models.filter((m: any) => !m.exclusion && m.identity).map((m: any) => m.identity.key);
    evidence.cohort = (await pg.query(`select c.model_number,c.id canonical_id,c.category,o.price,o.raw_obs_id,o.payload->>'_availability' availability,
      (select count(*)::int from normalized_product_observations n where n.canonical_product_id=c.id and n.store_id='6') npo_rows,
      (select count(*)::int from price_history h where h.canonical_product_id=c.id
        and (h.store_id=6 or h.store_name in ('سامسونج السعودية','samsung_ksa'))) price_rows
      from canonical_products c join tps_current_offers o on o.identity_key=c.tps_identity_key and o.category=c.category and o.store_id=6 and o.status='valid'
      where c.tps_identity_key=any($1::text[])`, [keys])).rows;
    evidence.missingHistoryRows = (await pg.query('select canonical_product_id,store_id,store_name,price from price_history where canonical_product_id=any($1::uuid[])',
      [evidence.cohort.filter((r: any) => Number(r.price) > 0 && !r.price_rows).map((r: any) => r.canonical_id)])).rows;
    writeFileSync(`docs/evidence/samsung-recovery-comparison-loss${phase ? '-' + phase : ''}-2026-09-16.json`, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify({ models: evidence.cohort.length, missingNpo: evidence.cohort.filter((r: any) => !r.npo_rows),
      pricedMissingHistory: evidence.cohort.filter((r: any) => Number(r.price) > 0 && !r.price_rows) }, null, 2));
  } finally { await pg.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
