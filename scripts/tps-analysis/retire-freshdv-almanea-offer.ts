// scripts/tps-analysis/retire-freshdv-almanea-offer.ts — ADR-387 identity remediation (one row).
//
// Manufacturer source (lg.com/sa_en): NF182C2 ("Fresh Inverter") and ND182C0 ("Fresh DV") are
// two different LG products. Almanea's listing is NF182C2, but the parser mapped bare «فريش» to
// FreshDV, so its current-state row sits under the ND182C0 identity. The parser is fixed in the
// same ADR (new observations key to `lg|split|Fresh|…`); this marks the mis-keyed current-state
// row as superseded by that identity — the exact mechanism `realize-samsung-recovery.ts` uses
// and that get-comparison.ts / search already honor — so the FreshDV comparison stops carrying
// an NF182C2 price. History (price_history / npo) is untouched and immutable.
//
//   npx tsx scripts/tps-analysis/retire-freshdv-almanea-offer.ts          # dry run
//   npx tsx scripts/tps-analysis/retire-freshdv-almanea-offer.ts --apply  # write (exports before-state)
// Rollback: update tps_current_offers set payload = payload - '_superseded_by_identity' where <pk>.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { writeFileSync } from 'fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require('pg') as { Client: new (o: { connectionString: string; ssl: { rejectUnauthorized: boolean } }) => { connect(): Promise<void>; end(): Promise<void>; query<T = Record<string, unknown>>(sql: string, args?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> } };

const APPLY = process.argv.includes('--apply');
const FROM_KEY = 'lg|split|FreshDV|18000|Inverter|cool_only';
const TO_KEY = 'lg|split|Fresh|18000|Inverter|cool_only';
const STORE_ID = 5; // almanea
const CATEGORY = 'air_conditioner';

async function main() {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL!, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const { rows } = await c.query(`select category, identity_key, store_id, status, price, url, name, observed_at, payload from tps_current_offers where category=$1 and identity_key=$2 and store_id=$3`, [CATEGORY, FROM_KEY, STORE_ID]);
  if (rows.length !== 1) { console.log(`expected exactly 1 row, found ${rows.length} — nothing done`); await c.end(); return; }
  const row = rows[0] as { name: string; price: string; payload: Record<string, unknown> };
  console.log('row:', JSON.stringify({ name: row.name, price: row.price, superseded: row.payload?._superseded_by_identity ?? null }));
  if (!/NF182C2/i.test(row.name)) { console.log('title does not carry NF182C2 — refusing (evidence mismatch)'); await c.end(); return; }
  const file = `docs/evidence/compare-freshness-2026-09-26/retire-freshdv-almanea-${APPLY ? 'applied' : 'dry'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), apply: APPLY, from: FROM_KEY, to: TO_KEY, store_id: STORE_ID, before: rows[0] }, null, 1));
  console.log('exported →', file);
  if (!APPLY) { console.log('DRY RUN — nothing written.'); await c.end(); return; }
  const res = await c.query(`update tps_current_offers set payload = coalesce(payload,'{}'::jsonb) || jsonb_build_object('_superseded_by_identity', $4::text), updated_at = now() where category=$1 and identity_key=$2 and store_id=$3`, [CATEGORY, FROM_KEY, STORE_ID, TO_KEY]);
  console.log(`APPLIED: ${res.rowCount} row updated. Rollback: update tps_current_offers set payload = payload - '_superseded_by_identity' where category='${CATEGORY}' and identity_key='${FROM_KEY}' and store_id=${STORE_ID};`);
  await c.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
