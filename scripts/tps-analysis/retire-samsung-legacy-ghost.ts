/** Retire orphaned legacy serving identities only after a fresh official redirect
 * and proof that no other merchant has evidence on the identity. History stays. */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { readFileSync, writeFileSync } from 'fs';
import { toPoolerDbUrl } from '../tps-core/pooler-url';
import { isSamsungKsaProductUrl } from '../../src/lib/scraping/stores/samsung-ksa-scraper';
const { Client } = require('pg');
async function main() {
  const apply = process.argv.includes('--apply');
  const source = JSON.parse(readFileSync('docs/evidence/samsung-recovery-source-reconciliation-2026-09-16.json', 'utf8'));
  const included = source.models.filter((m: any) => !m.exclusion && m.identity).map((m: any) => m.model);
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false }, statement_timeout: 30000 });
  await pg.connect();
  const evidence: any = { startedAt: new Date().toISOString(), apply, rows: [] };
  const file = `docs/evidence/samsung-recovery-legacy-ghost-${Date.now()}.json`;
  const save = () => writeFileSync(file, JSON.stringify(evidence, null, 2));
  try {
    if (apply && !(await pg.query('select pg_try_advisory_lock($1) ok', [8148148])).rows[0].ok) throw new Error('Normalizer lane busy');
    const candidates = (await pg.query(`select c.*,ps.product_url from products p join product_stores ps on ps.product_id=p.id and ps.store_id=6
      join canonical_products c on c.id=p.canonical_product_id where c.is_active and p.model<>all($1::text[])
      and c.tps_identity_key not like 'samsung|MODEL:%'
      and not exists(select 1 from tps_current_offers o where o.identity_key=c.tps_identity_key)
      and not exists(select 1 from normalized_product_observations n where n.canonical_product_id=c.id and n.store_id is distinct from '6')
      and not exists(select 1 from price_history h where h.canonical_product_id=c.id and
        coalesce(h.store_id=6 or h.store_name in ('سامسونج السعودية','samsung_ksa'),false)=false)
      and not exists(select 1 from products linked join product_stores other on other.product_id=linked.id
        where linked.canonical_product_id=c.id and other.store_id<>6)`, [included])).rows;
    for (const c of candidates) {
      const row: any = { canonicalBefore: c, observedAt: new Date().toISOString() };
      const response = await fetch(c.product_url, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) });
      row.source = { status: response.status, finalUrl: response.url };
      row.provenNonProductRedirect = response.ok && response.url !== c.product_url
        && new URL(response.url).hostname === 'www.samsung.com'
        && /^\/(sa|sa_en)\//.test(new URL(response.url).pathname) && !isSamsungKsaProductUrl(response.url);
      await response.body?.cancel();
      row.projectionBefore = (await pg.query('select * from tps_product_projection where canonical_id=$1', [c.id])).rows;
      evidence.rows.push(row); save();
      if (apply && row.provenNonProductRedirect) {
        await pg.query('BEGIN');
        await pg.query('update canonical_products set is_active=false where id=$1', [c.id]);
        await pg.query('delete from tps_product_projection where canonical_id=$1', [c.id]);
        await pg.query('COMMIT'); row.retiredAt = new Date().toISOString(); save();
      }
    }
    evidence.completedAt = new Date().toISOString(); save();
    console.log(JSON.stringify({ file, apply, candidates: candidates.length, redirectConfirmed: evidence.rows.filter((r: any) => r.provenNonProductRedirect).length, retired: evidence.rows.filter((r: any) => r.retiredAt).length }));
  } catch (error) { await pg.query('ROLLBACK').catch(() => {}); evidence.error = String(error); save(); throw error; }
  finally { await pg.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
