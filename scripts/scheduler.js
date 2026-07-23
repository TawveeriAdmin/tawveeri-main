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

const INTERVAL_MS = parseInt(process.env.SCHEDULER_INTERVAL_MS || '60000', 10);
// Hourly by default: ingestion runs a few times a day, so an hourly chain keeps
// the customer-facing layers within one cycle of the evidence without churn.
const REFRESH_INTERVAL_MS = parseInt(process.env.REFRESH_INTERVAL_MS || String(60 * 60 * 1000), 10);
// The full chain includes a ~13-minute projection rebuild. That is run less
// often (default every 12h) because canonicals change far slower than prices.
const FULL_REFRESH_INTERVAL_MS = parseInt(process.env.FULL_REFRESH_INTERVAL_MS || String(12 * 60 * 60 * 1000), 10);
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
console.log(`[refresh]   intelligence chain every ${(REFRESH_INTERVAL_MS / 60000).toFixed(0)}m (full every ${(FULL_REFRESH_INTERVAL_MS / 3600000).toFixed(0)}h)`);

// Fire once immediately so PM2 restarts have an instant first tick, then every N ms.
tick();
setInterval(tick, INTERVAL_MS);

// Intelligence refresh. Deliberately NOT fired immediately on boot: a PM2
// restart loop would otherwise trigger repeated multi-minute rebuilds.
setInterval(() => runRefresh(false), REFRESH_INTERVAL_MS);
setInterval(() => runRefresh(true), FULL_REFRESH_INTERVAL_MS);

process.on('SIGTERM', () => {
  console.log('[scheduler] SIGTERM received — exiting');
  process.exit(0);
});
