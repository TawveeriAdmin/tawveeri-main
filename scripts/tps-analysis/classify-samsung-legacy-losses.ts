import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { readFileSync, writeFileSync } from 'fs';
import { toPoolerDbUrl } from '../tps-core/pooler-url';
import { samsungCatalogExclusion } from '../tps-core/samsung-manufacturer-identity';
const { Client } = require('pg');
async function main() {
  const source = JSON.parse(readFileSync('docs/evidence/samsung-recovery-source-reconciliation-2026-09-16.json', 'utf8'));
  const included = new Set(source.models.filter((m: any) => !m.exclusion && m.identity).map((m: any) => m.model));
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  try {
    const rows = (await pg.query(`select p.id,p.model,p.canonical_product_id,p.is_active,ps.product_url,
      c.id exact_canonical_id,o.status,o.price,o.payload->>'_availability' availability
      from products p join product_stores ps on ps.product_id=p.id and ps.store_id=6
      left join canonical_products c on c.tps_identity_key='samsung|MODEL:'||upper(trim(p.model))
      left join tps_current_offers o on o.identity_key=c.tps_identity_key and o.store_id=6 and o.category=c.category`)).rows;
    for (const row of rows) {
      const model = (row.model || '').trim().toUpperCase();
      const purchasable = row.status === 'valid' && Number(row.price) > 0
        && ['in_stock','limited_stock','pre_order'].includes(row.availability);
      row.reason = samsungCatalogExclusion(model) || (!model ? 'MISSING_MODEL'
        : !included.has(model) ? 'LEGACY_MODEL_NOT_IN_VERIFIED_CURRENT_SOURCE'
        : row.canonical_product_id !== row.exact_canonical_id ? 'EXACT_CANONICAL_LINK_MISSING'
        : !purchasable ? 'NO_AFFIRMED_PURCHASABLE_OFFER'
        : !row.is_active ? 'LEGACY_INACTIVE_WITH_CURRENT_OFFER' : 'CURRENT_ELIGIBLE');
    }
    const counts = rows.reduce((out: any, row: any) => { out[row.reason] = (out[row.reason] || 0) + 1; return out; }, {});
    writeFileSync('docs/evidence/samsung-recovery-legacy-loss-reasons-2026-09-16.json', JSON.stringify({ measuredAt: new Date().toISOString(),
      method: 'All Samsung legacy rows; exact full-model source and canonical/current-offer joins, no fuzzy inference', counts, rows }, null, 2));
    console.log(JSON.stringify(counts));
  } finally { await pg.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
