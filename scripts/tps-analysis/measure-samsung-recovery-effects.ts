import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { readFileSync, writeFileSync } from 'fs';
import { toPoolerDbUrl } from '../tps-core/pooler-url';
const { Client } = require('pg');
async function main() {
  const journalPath = process.argv[2];
  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  const source = JSON.parse(readFileSync('docs/evidence/samsung-recovery-source-reconciliation-2026-09-16.json', 'utf8'));
  const included = source.models.filter((m: any) => !m.exclusion && m.identity);
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false }, statement_timeout: 45000 });
  await pg.connect();
  try {
    const raw = (await pg.query(`select upper(payload->>'sku') model,min(scraped_at) first_observed_at,max(scraped_at) last_observed_at,
      count(*)::int observations,count(*) filter(where scraped_at<$1)::int before_observations
      from raw_observations where store_id=6 and payload->>'sku' is not null group by upper(payload->>'sku')`, [journal.observedAt])).rows;
    const rawByModel = new Map(raw.map((r: any) => [r.model, r])) as Map<string, any>;
    const legacy = new Set(journal.before.legacy.map((r: any) => r.model));
    const oldOffers = new Set(journal.before.offers.filter((r: any) => r.store_id === 6).map((r: any) => r.raw_payload?.sku));
    const exact = new Set(journal.before.canonicals.map((r: any) => r.tps_identity_key));
    const rows = included.map((m: any) => ({ model: m.model, category: m.identity.category, beforeRaw: (rawByModel.get(m.model)?.before_observations || 0) > 0,
      beforeLegacy: legacy.has(m.model), beforeOfferUnderAnyIdentity: oldOffers.has(m.model), beforeExactCanonical: exact.has(m.identity.key),
      raw: rawByModel.get(m.model) || null }));
    const summary = { source: rows.length, representedInRawBefore: rows.filter((r: any) => r.beforeRaw).length,
      representedInLegacyBefore: rows.filter((r: any) => r.beforeLegacy).length,
      representedInOfferBefore: rows.filter((r: any) => r.beforeOfferUnderAnyIdentity).length,
      exactCanonicalBefore: rows.filter((r: any) => r.beforeExactCanonical).length,
      firstRawAfterRecoveryStarted: rows.filter((r: any) => !r.beforeRaw && r.raw).length,
      noRawNow: rows.filter((r: any) => !r.raw).length };
    writeFileSync('docs/evidence/samsung-recovery-attribution-2026-09-16.json', JSON.stringify({ measuredAt: new Date().toISOString(),
      journalPath, recoveryStartedAt: journal.observedAt, method: 'Immutable raw first-observation timestamps and pre-write journal. Newly represented is distinct from exact identity repair; timestamp association alone is not causal attribution to a worker.', summary, rows }, null, 2));
    console.log(JSON.stringify(summary));
  } finally { await pg.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
