import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
    startIntelligenceScheduler();
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

/**
 * Spawn the intelligence scheduler as a detached child of the web server (ADR-078).
 *
 * WHY here and not a launcher: Railway routes traffic to the port opened by the
 * start command's MAIN process. A first attempt wrapped the web server as a child
 * of a launcher script — Railway could not see the port and served 502. Keeping
 * the web server as the main process and spawning the scheduler FROM it fixes that.
 *
 * BULLETPROOF by construction: this runs inside the already-started web server,
 * everything is wrapped in try/catch, the child is fully detached + unref'd with
 * stdio ignored, and its errors are swallowed. The worst case is "the scheduler
 * did not start" — i.e. no automatic refresh, the pre-ADR-078 behaviour — never a
 * degraded or downed web server. Set DISABLE_INPROCESS_SCHEDULER=1 to opt out.
 */
function startIntelligenceScheduler() {
  try {
    const g = globalThis as unknown as { __tawveeriSchedulerStarted?: boolean };
    if (g.__tawveeriSchedulerStarted) return;               // one per process
    if (process.env.DISABLE_INPROCESS_SCHEDULER === '1') return;
    g.__tawveeriSchedulerStarted = true;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { spawn } = require('child_process') as typeof import('child_process');
    const child = spawn(process.execPath, ['scripts/scheduler.js'], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    });
    child.on('error', () => { /* best-effort: never propagate to the web server */ });
    child.unref();
    console.log(`[instrumentation] intelligence scheduler spawned (pid ${child.pid})`);
  } catch (err) {
    console.error('[instrumentation] scheduler not started (web server unaffected):',
      err instanceof Error ? err.message : err);
  }
}

export const onRequestError = Sentry.captureRequestError;
