/**
 * Production launcher (ADR-078).
 *
 * Railway's start command runs ONE process. Before this, that was only the
 * Next.js standalone server, so `scripts/scheduler.js` — which runs the derived-
 * intelligence chain hourly (ADR-065/067) — never started in production. The
 * chain therefore only ran when a human executed it, and the customer-facing
 * projection / search index drifted between manual runs (the exact failure
 * ADR-062 describes: 68% of the catalogue once unsearchable for ~34h).
 *
 * This launcher runs BOTH in one container:
 *   • the web server — PRIMARY. If it exits, the launcher exits with its code so
 *     Railway restarts the container. Invoked byte-identically to the old
 *     `npm start` (`node .next/standalone/server.js`, HOSTNAME=0.0.0.0).
 *   • the scheduler — BEST-EFFORT and fully failure-isolated. If it cannot start,
 *     crashes, or the chain errors, the web server is unaffected — the worst case
 *     is "no automatic refresh", i.e. today's behaviour, never a downed site.
 *
 * A separate PM2/worker service would be architecturally cleaner, but Railway
 * config-as-code cannot declare a second service; one supervised container is the
 * pragmatic, reversible choice for a pre-launch platform.
 */
const { spawn } = require('child_process');

function log(msg) { console.log(`[launcher] ${msg}`); }

// ── Web server (PRIMARY) ─────────────────────────────────────────────────────
const web = spawn('node', ['.next/standalone/server.js'], {
  stdio: 'inherit',
  env: { ...process.env, HOSTNAME: process.env.HOSTNAME || '0.0.0.0' },
});
log(`web server started (pid ${web.pid})`);

let shuttingDown = false;
web.on('exit', (code, signal) => {
  if (shuttingDown) return;
  log(`web server exited (code ${code}, signal ${signal}); exiting so Railway restarts the container`);
  process.exit(code == null ? 1 : code);
});
web.on('error', (err) => {
  log(`web server failed to start: ${err && err.message}`);
  process.exit(1);
});

// ── Scheduler (BEST-EFFORT, failure-isolated) ────────────────────────────────
// Started slightly after the web server so the refresh loop's dispatch pokes and
// any immediate work don't compete with server warm-up. Never allowed to affect
// the web process: all its errors are caught and logged only.
let scheduler = null;
function startScheduler() {
  try {
    scheduler = spawn('node', ['scripts/scheduler.js'], { stdio: 'inherit', env: process.env });
    log(`scheduler started (pid ${scheduler.pid})`);
    scheduler.on('exit', (code, signal) => {
      scheduler = null;
      if (shuttingDown) return;
      log(`scheduler exited (code ${code}, signal ${signal}) — web server continues; retrying in 60s`);
      setTimeout(startScheduler, 60_000); // resilient: a crashed scheduler self-heals without touching the web server
    });
    scheduler.on('error', (err) => log(`scheduler error (ignored, web unaffected): ${err && err.message}`));
  } catch (err) {
    log(`scheduler could not be spawned (ignored, web unaffected): ${err && err.message}`);
  }
}
setTimeout(startScheduler, 8_000);

// ── Signals ──────────────────────────────────────────────────────────────────
function shutdown(sig) {
  shuttingDown = true;
  log(`${sig} received — shutting down`);
  try { if (scheduler) scheduler.kill('SIGTERM'); } catch { /* ignore */ }
  try { web.kill('SIGTERM'); } catch { /* ignore */ }
  setTimeout(() => process.exit(0), 3_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
