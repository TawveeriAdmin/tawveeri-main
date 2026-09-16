import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { writeFileSync } from 'fs';
import { toPoolerDbUrl } from '../tps-core/pooler-url';
import { manufacturerCategoryTerms } from '../../src/lib/search/manufacturer-category-terms';
const { Client } = require('pg');
async function main() {
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  try {
    const rows = (await pg.query(`select c.category,c.model_number,c.tps_identity_key,c.attributes,c.name_en,o.price
      from canonical_products c join tps_current_offers o on o.identity_key=c.tps_identity_key and o.category=c.category
      where o.store_id=6 and o.status='valid' and o.price>0 and o.payload->>'_availability' in ('in_stock','limited_stock','pre_order')
      and c.category=any($1::text[])`, [['tablet','audio','refrigerator','washing_machine','smartwatch']])).rows;
    for (const row of rows) row.categoryTerms = manufacturerCategoryTerms(row);
    writeFileSync('docs/evidence/samsung-recovery-category-eligibility-2026-09-16.json', JSON.stringify({ observedAt: new Date().toISOString(), rows }, null, 2));
    console.log(JSON.stringify({ counts: rows.reduce((s: any, r: any) => { s[r.category] = (s[r.category] || 0) + 1; return s; }, {}),
      missing: rows.filter((r: any) => !r.categoryTerms).map((r: any) => ({ model: r.model_number, category: r.category, attributes: r.attributes })) }, null, 2));
  } finally { await pg.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
