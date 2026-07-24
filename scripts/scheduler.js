/**
 * Tawveeri scheduler — runs as a PM2 app alongside the Next.js cluster.
 *
 * Two independent loops:
 *   1. SCRAPING   every minute, pokes /api/cron/dispatch (scraping_schedules).
 *   2. INTELLIGENCE REFRESH (ADR-065) every REFRESH_INTERVAL_MS, runs the
 *      derived-intelligence chain so improvements actually reach customers.
 *
 * Why the refresh runs as a CHILD PROCESS rather than an HTTP route: the chain
 * takes minutes (the listing-facts build alone is ~95s), which exceeds any sane
 * request timeout. Spawning it here keeps it under PM2 supervision, gives it the
 * scheduler's environment, and removes the HTTP timeout ceiling entirely.
 *
 * This loop exists because of a measured failure: the search index once held 394
 * of 1,215 products and had not been rebuilt in ~34 hours — 68% of the catalogue
 * was unsearchable, including a full day of identity work, because every link in
 * the chain was a script a human had to remember to run (ADR-062).
 *
 * Deployed via ecosystem.config.js as a single-instance (non-cluster) app.
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { spawn } = require('child_process');

// ── Heartbeat (ADR-078) ──────────────────────────────────────────────────────
// The scheduler runs in production but leaves no DB trace until its first hourly
// refresh, so there is no way to confirm it actually STARTED (the cwd-path bug
// meant it silently never did). This writes a single-row heartbeat on boot and
// every tick, so `tps:health` / a query can confirm liveness within a minute —
// independent of Railway logs. Best-effort: any failure here never affects scheduling.
let hbClient = null;
async function heartbeat(field) {
  try {
    if (!process.env.SUPABASE_DB_URL) return;
    if (!hbClient) {
      const { Client } = require('pg');
      hbClient = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
      await hbClient.connect();
      await hbClient.query(`create table if not exists tps_scheduler_heartbeat (
        id int primary key default 1, pid int, booted_at timestamptz, last_tick timestamptz,
        last_refresh_at timestamptz, last_refresh_status text)`);
    }
    if (field === 'boot') {
      await hbClient.query(`insert into tps_scheduler_heartbeat (id,pid,booted_at,last_tick) values (1,$1,now(),now())
        on conflict (id) do update set pid=$1, booted_at=now(), last_tick=now()`, [process.pid]);
    } else if (field === 'tick') {
      await hbClient.query(`update tps_scheduler_heartbeat set last_tick=now() where id=1`);
    } else if (typeof field === 'object') {
      await hbClient.query(`update tps_scheduler_heartbeat set last_refresh_at=now(), last_refresh_status=$1 where id=1`, [field.status]);
    }
  } catch (e) { /* never let heartbeat failure affect the scheduler */ }
}

const INTERVAL_MS = parseInt(process.env.SCHEDULER_INTERVAL_MS || '60000', 10);
// ADR-067 changed what is affordable here. The projection rebuild went from
// ~21.6 MINUTES to ~12 SECONDS when it became set-based, taking the full chain
// from 25.4 min to 4.6 min. A 12-hourly full refresh was a workaround for a slow
// builder; now the FULL chain runs hourly and there is no separate fast tier —
// projection freshness improves from "up to 12h stale" to "within the hour".
const REFRESH_INTERVAL_MS = parseInt(process.env.REFRESH_INTERVAL_MS || String(60 * 60 * 1000), 10);
// Retained for operators who want to throttle the chain on constrained hosts:
// set FULL_REFRESH_INTERVAL_MS to run the full chain less often than hourly.
const FULL_REFRESH_INTERVAL_MS = parseInt(process.env.FULL_REFRESH_INTERVAL_MS || "0", 10);
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('[scheduler] CRON_SECRET missing — refusing to start');
  process.exit(1);
}

// ── Intelligence refresh loop ───────────────────────────────────────────────
let refreshRunning = false;

/**
 * Run the refresh chain. `full` also rebuilds the projection. Overlapping runs
 * are refused rather than queued: two concurrent rebuilds would fight over the
 * same derived tables, and skipping a tick is harmless because the next one
 * recomputes from the same evidence (every step is idempotent).
 */
function runRefresh(full) {
  if (refreshRunning) {
    console.log('[refresh] previous run still in progress — skipping this tick');
    return;
  }
  refreshRunning = true;
  const started = Date.now();
  const args = ['tsx', 'scripts/tps-core/refresh-intelligence.ts'];
  if (!full) args.push('--fast');
  // `presentation` (images + measured exit links) is part of the chain, so a
  // newly-projected product never reaches search without a picture or a way to buy.
  const child = spawn('npx', args, { cwd: process.cwd(), shell: true, env: process.env });

  let tail = '';
  const capture = (buf) => { tail = (tail + buf.toString()).slice(-1500); };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);

  child.on('close', (code) => {
    refreshRunning = false;
    const mins = ((Date.now() - started) / 60000).toFixed(1);
    heartbeat({ status: code === 0 ? 'ok' : `fail(${code})` });
    if (code === 0) {
      console.log(`[refresh] ${full ? 'full' : 'fast'} chain OK in ${mins}m`);
    } else {
      console.error(`[refresh] ${full ? 'full' : 'fast'} chain FAILED (exit ${code}) after ${mins}m`);
      console.error(tail.split('\n').filter((l) => l.includes('FAIL') || l.includes('SKIP')).join('\n'));
    }
  });
  child.on('error', (err) => {
    refreshRunning = false;
    console.error('[refresh] could not start:', err?.message || err);
  });
}

async function tick() {
  const started = Date.now();
  heartbeat('tick');
  try {
    const res = await fetch(`${BASE_URL}/api/cron/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CRON_SECRET}`,
      },
      body: '{}',
    });
    const elapsed = Date.now() - started;
    if (!res.ok) {
      console.error(`[scheduler] dispatch HTTP ${res.status} after ${elapsed}ms`);
      return;
    }
    const json = await res.json();
    if (json?.dispatched?.length) {
      console.log(
        `[scheduler] ${elapsed}ms — dispatched ${json.dispatched.length} schedule(s):`,
        json.dispatched.map((d) => `${d.store_slug}/${d.job_type}`).join(', ')
      );
    }
  } catch (err) {
    console.error('[scheduler] tick failed:', err?.message || err);
  }
}

// Signal PM2 that we're ready (matches wait_ready in ecosystem.config.js).
if (process.send) {
  process.send('ready');
}

console.log(`[scheduler] started — polling ${BASE_URL}/api/cron/dispatch every ${INTERVAL_MS}ms`);
console.log(`[refresh]   full intelligence chain every ${(REFRESH_INTERVAL_MS / 60000).toFixed(0)}m (~4.6 min per run since ADR-067)`);

// Write a boot heartbeat immediately so liveness is confirmable within a minute.
heartbeat('boot');
// Fire once immediately so PM2 restarts have an instant first tick, then every N ms.
tick();
setInterval(tick, INTERVAL_MS);

// Intelligence refresh. Deliberately NOT fired immediately on boot: a PM2
// restart loop would otherwise trigger repeated multi-minute rebuilds.
// The full chain is ~4.6 min since ADR-067, so it is the default hourly job.
setInterval(() => runRefresh(true), REFRESH_INTERVAL_MS);
if (FULL_REFRESH_INTERVAL_MS > 0) setInterval(() => runRefresh(true), FULL_REFRESH_INTERVAL_MS);

process.on('SIGTERM', () => {
  console.log('[scheduler] SIGTERM received — exiting');
  process.exit(0);
});
