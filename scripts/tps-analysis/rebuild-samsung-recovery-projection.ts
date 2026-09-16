import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { toPoolerDbUrl } from '../tps-core/pooler-url';
import { guardSamsungConnections } from '../tps-core/samsung-connection-guard';
import { runSamsungWorkerChild } from '../tps-core/samsung-worker-child';
const { Client } = require('pg');
async function main() {
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL!), ssl: { rejectUnauthorized: false }, keepAlive: true });
  await pg.connect();
  const guard = guardSamsungConnections([pg]);
  try {
    if (!(await pg.query('select pg_try_advisory_lock($1) ok', [8148148])).rows[0].ok) throw new Error('Normalization lane busy');
    guard.assertHealthy();
    await runSamsungWorkerChild('scripts/build-tps-projection.ts', ['--samsung-only']);
    guard.assertHealthy();
  } finally { guard.close(); await pg.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
