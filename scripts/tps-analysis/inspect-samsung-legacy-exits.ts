import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { writeFileSync } from 'fs';
import { toPoolerDbUrl } from '../tps-core/pooler-url';
const { Client } = require('pg');
async function main() {
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  try {
    const rows = (await pg.query(`select p.model,p.id,p.is_active,p.canonical_product_id,c.tps_identity_key,c.is_active canonical_active,
      (select count(*)::int from price_history h where h.canonical_product_id=c.id and (h.store_id=6 or h.store_name='سامسونج السعودية')) samsung_history,
      (select jsonb_agg(jsonb_build_object('store',o.store_id,'status',o.status,'price',o.price)) from tps_current_offers o where o.identity_key=c.tps_identity_key) current_offers
      from products p left join canonical_products c on c.id=p.canonical_product_id where p.model=any($1::text[])`,
      [['HW-T400/ZN', 'QA55LS03DAUXSA']])).rows;
    const result = { observedAt: new Date().toISOString(), rows };
    writeFileSync('docs/evidence/samsung-recovery-legacy-exits-before-2026-09-16.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally { await pg.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
