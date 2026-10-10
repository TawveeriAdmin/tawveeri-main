/* ADR-408 — quarantine of Amazon current offers whose URL ASIN differs from the ASIN of the page that was read (the SKU),
 * in every category. Generalises scripts/tps-analysis/mobile-closure-data.cjs (ADR-405's phone case).
 *
 *   node scripts/tps-analysis/amazon-asin-quarantine.cjs export     read-only: what would change (writes the evidence file)
 *   node scripts/tps-analysis/amazon-asin-quarantine.cjs apply      one transaction: status='invalid' + payload._identity_quarantine
 *   node scripts/tps-analysis/amazon-asin-quarantine.cjs rollback   restores exactly the rows exported by `apply`
 *
 * Touches only tps_current_offers (store 2, status valid|low_confidence_candidate, never already marked). Raw observations,
 * normalized observations, canonicals, price history, storefront rows and outbound relationships are not read for writing.
 * A later CLEAN observation of the same identity overwrites the row and lifts the quarantine by itself. */
require('dotenv').config({ path: '.env.local', quiet: true });
const fs = require('fs');
const { Client } = require('pg');
const { toPoolerDbUrl } = require('../tps-core/pooler-url');
const MARK = 'asin_url_sku_conflict_2026_10_10';
const dir = 'docs/evidence/amazon-asin-guard-2026-10-10';
const mode = process.argv[2] || 'export';
const SELECT = `
  select o.category, o.identity_key, o.store_id, o.raw_obs_id, o.status, o.price, o.url, o.name, o.confidence, o.payload, o.observed_at, o.updated_at,
         upper(substring(o.url from '/(?:dp|gp/product|gp/aw/d)/([A-Za-z0-9]{10})(?:[/?&#]|$)')) as url_asin,
         upper(r.payload->>'sku') as sku
    from tps_current_offers o join raw_observations r on r.id = o.raw_obs_id
   where o.store_id = 2 and o.status in ('valid', 'low_confidence_candidate')
     and coalesce(o.payload->>'_identity_quarantine', '') = ''
     and substring(o.url from '/(?:dp|gp/product|gp/aw/d)/([A-Za-z0-9]{10})(?:[/?&#]|$)') is not null
     and upper(r.payload->>'sku') ~ '^[A-Z0-9]{10}$'
     and upper(substring(o.url from '/(?:dp|gp/product|gp/aw/d)/([A-Za-z0-9]{10})(?:[/?&#]|$)')) <> upper(r.payload->>'sku')
   order by o.category, o.identity_key`;

async function main() {
  fs.mkdirSync(dir, { recursive: true });
  const db = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  await db.connect();
  try {
    await db.query(mode === 'export' ? 'BEGIN READ ONLY' : 'BEGIN');
    await db.query("SET LOCAL statement_timeout = '60s'");
    await db.query("SET LOCAL lock_timeout = '3s'");
    if (mode === 'rollback') {
      const saved = JSON.parse(fs.readFileSync(`${dir}/quarantine-before.json`, 'utf8'));
      for (const c of saved.rows) {
        const r = await db.query(
          `update tps_current_offers set status=$1, payload=$2::jsonb, updated_at=$3
            where category=$4 and identity_key=$5 and store_id=2 and raw_obs_id=$6 and payload->>'_identity_quarantine'=$7`,
          [c.status, JSON.stringify(c.payload), c.updated_at, c.category, c.identity_key, c.raw_obs_id, MARK]);
        if (r.rowCount !== 1) throw Error(`Rollback refused: row changed for ${c.identity_key} (a clean observation may already have replaced it)`);
      }
      await db.query('COMMIT');
      console.log(`Restored ${saved.rows.length} rows`);
      return;
    }
    const rows = (await db.query(SELECT)).rows;
    const out = { at: new Date().toISOString(), mode, marker: MARK, count: rows.length, rows };
    const beforePath = `${dir}/quarantine-before.json`;
    if (mode === 'apply' && !fs.existsSync(beforePath)) fs.writeFileSync(beforePath, JSON.stringify(out, null, 2));
    fs.writeFileSync(`${dir}/quarantine-${mode}.json`, JSON.stringify(out, null, 2));
    if (mode === 'apply') {
      for (const c of rows) {
        const r = await db.query(
          `update tps_current_offers set status='invalid', payload=coalesce(payload,'{}'::jsonb) || jsonb_build_object('_identity_quarantine', $1::text), updated_at=now()
            where category=$2 and identity_key=$3 and store_id=2 and raw_obs_id=$4 and status in ('valid','low_confidence_candidate')`,
          [MARK, c.category, c.identity_key, c.raw_obs_id]);
        if (r.rowCount !== 1) throw Error(`Concurrent change on ${c.identity_key}; refusing`);
      }
      await db.query('COMMIT');
    } else await db.query('ROLLBACK');
    const by = {};
    for (const c of rows) by[c.category] = (by[c.category] || 0) + 1;
    console.log(JSON.stringify({ mode, count: rows.length, byCategory: by }));
  } catch (e) { await db.query('ROLLBACK').catch(() => {}); throw e; }
  finally { await db.end(); }
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; });
