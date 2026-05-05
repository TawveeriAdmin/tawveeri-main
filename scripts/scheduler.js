/**
 * Tawveeri scraping scheduler — runs as a third PM2 app alongside the Next.js
 * cluster. Every minute it pokes /api/cron/dispatch which reads scraping_schedules
 * and fires off per-store cron routes.
 *
 * Deployed via ecosystem.config.js as a single-instance (non-cluster) app.
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const INTERVAL_MS = parseInt(process.env.SCHEDULER_INTERVAL_MS || '60000', 10);
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('[scheduler] CRON_SECRET missing — refusing to start');
  process.exit(1);
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

// Fire once immediately so PM2 restarts have an instant first tick, then every N ms.
tick();
setInterval(tick, INTERVAL_MS);

process.on('SIGTERM', () => {
  console.log('[scheduler] SIGTERM received — exiting');
  process.exit(0);
});
