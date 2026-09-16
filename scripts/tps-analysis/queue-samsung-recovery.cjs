/* Explicit one-time request for the existing Samsung scheduler, not a fake success. */
require('dotenv').config({ path: '.env.local', quiet: true });
const fs = require('fs');
const { Client } = require('pg');
const { toPoolerDbUrl } = require('../tps-core/pooler-url');
(async () => {
  const expected = process.argv.find(a => a.startsWith('--commit='))?.slice(9);
  if (!expected || !process.argv.includes('--apply')) throw new Error('Explicit --commit=SHA --apply required');
  const response = await fetch('https://tawveeri.com/api/debug/scheduler', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  const runtime = await response.json();
  if (response.status !== 200 || runtime.commit !== expected) throw new Error('Expected production commit is not live');
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const evidence = { requestedAt: new Date().toISOString(), expected, runtime, reason: 'Owner-authorized initial full catalog realization after ADR-373 deployment; prior success belongs to old discovery contract.' };
  const output = `docs/evidence/samsung-recovery-queue-${Date.now()}.json`;
  try {
    await pg.query('BEGIN');
    evidence.before = (await pg.query("select * from tps_job_state where job='samsung-delta-watch' for update")).rows;
    if (evidence.before.length !== 1) throw new Error('Expected one existing Samsung job state');
    fs.writeFileSync(output, JSON.stringify(evidence, null, 2));
    await pg.query("update tps_job_state set last_success_at=null,last_note=$1,updated_at=now() where job='samsung-delta-watch'",
      [`ADR-373 full catalog requested on ${expected}; previous successful job is archived in recovery evidence`]);
    await pg.query('COMMIT');
    evidence.queuedAt = new Date().toISOString();
    fs.writeFileSync(output, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify({ output, commit: expected, queuedAt: evidence.queuedAt }));
  } catch (error) { await pg.query('ROLLBACK'); throw error; }
  finally { await pg.end(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
