#!/usr/bin/env node
// run-19-dryrun.js — rehearse migration 19 AND its rollback with zero production impact.
//
// "Verify rollback before execution" taken literally: both files run inside ONE transaction that
// is then ROLLED BACK. That proves they parse, execute in order, and leave nothing behind —
// and because Supabase's `pgrst_ddl_watch` NOTIFY is transactional, a rolled-back rehearsal
// delivers no schema-reload notification at all. The rehearsal is free; the real run is the only
// thing that costs a reload.
//
//   node scripts/database/run-19-dryrun.js          # rehearse both, commit nothing
//   node scripts/database/run-19-dryrun.js --apply  # execute the forward migration for real
//   node scripts/database/run-19-dryrun.js --rollback
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const { readFileSync } = require('fs');
const { join } = require('path');
const { toPoolerDbUrl } = require('../tps-core/pooler-url');

const FORWARD = join(__dirname, '19-validation-events.sql');
const ROLLBACK = join(__dirname, '19-validation-events-rollback.sql');

(async () => {
  const { Client } = require('pg');
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL);
  if (!url) { console.error('SUPABASE_DB_URL is not set'); process.exit(1); }

  // The pooler intermittently refuses a first connection from a residential IP (measured
  // 2026-08-01: three ETIMEDOUT in five attempts, all four resolved addresses). Retry rather
  // than half-apply a migration because a TCP handshake was unlucky.
  const connect = async () => {
    let lastErr;
    for (let attempt = 1; attempt <= 5; attempt++) {
      const c = new Client({
        connectionString: url,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 20000,
      });
      try {
        await c.connect();
        if (attempt > 1) console.log(`(connected on attempt ${attempt})`);
        return c;
      } catch (e) {
        lastErr = e;
        try { await c.end(); } catch { /* already dead */ }
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
    throw lastErr;
  };
  const client = await connect();

  // Prove which project this is before touching it (ADR-007: prove identity before acting).
  const { rows: who } = await client.query('select current_database() db, current_user usr');
  console.log(`connected: ${who[0].db} as ${who[0].usr}`);
  const ref = (url.match(/postgres\.([a-z0-9]+)/) || [])[1] || 'unknown';
  console.log(`project ref: ${ref}`);
  if (ref !== 'vyceqrzttspyycdpojtn') {
    console.error(`REFUSING — expected production ref vyceqrzttspyycdpojtn, got ${ref}`);
    await client.end();
    process.exit(1);
  }

  const mode = process.argv.includes('--apply') ? 'apply'
    : process.argv.includes('--rollback') ? 'rollback'
    : 'dryrun';

  try {
    if (mode === 'dryrun') {
      console.log('\nDRY RUN — forward + rollback in one transaction, then ROLLBACK\n');
      await client.query('begin');
      await client.query(readFileSync(FORWARD, 'utf8'));
      console.log('  ✓ forward migration executed');
      const { rows: t } = await client.query(
        "select count(*)::int n from information_schema.tables where table_schema='observability' and table_name='validation_events'",
      );
      console.log(`  ✓ table present inside the transaction: ${t[0].n === 1}`);
      // Prove the table actually accepts the shape the writer will send.
      await client.query(
        `insert into observability.validation_events
           (occurred_at, outcome, surface, query, generated, generated_truncated,
            violated_rules, findings, decision, vocabulary_version, fingerprint)
         values (now(), 'rejected', 'dryrun', 'q', 'g', false, '{refresh-cadence}',
                 '[{"ruleId":"refresh-cadence","reason":"r","match":"m"}]'::jsonb,
                 'suppressed-fell-back-to-deterministic', 'v', 'f')`,
      );
      console.log('  ✓ a representative event inserts cleanly');
      await client.query(readFileSync(ROLLBACK, 'utf8'));
      console.log('  ✓ rollback executed');
      const { rows: s } = await client.query(
        "select count(*)::int n from information_schema.schemata where schema_name='observability'",
      );
      console.log(`  ✓ schema gone after rollback: ${s[0].n === 0}`);
      await client.query('rollback');
      console.log('\n  ✓ transaction ROLLED BACK — nothing committed, no schema reload fired');
    } else if (mode === 'apply') {
      console.log('\nAPPLYING forward migration (real DDL — fires one PostgREST reload)\n');
      await client.query(readFileSync(FORWARD, 'utf8'));
      const { rows } = await client.query(
        "select count(*)::int n from information_schema.tables where table_schema='observability' and table_name='validation_events'",
      );
      console.log(`  ✓ observability.validation_events present: ${rows[0].n === 1}`);
    } else {
      console.log('\nROLLING BACK (real DDL — destroys recorded events)\n');
      await client.query(readFileSync(ROLLBACK, 'utf8'));
      console.log('  ✓ rolled back');
    }
  } catch (e) {
    console.error('FAILED:', e.message);
    try { await client.query('rollback'); } catch { /* not in a transaction */ }
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
