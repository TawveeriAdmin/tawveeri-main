import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    (globalThis as Record<string, unknown>).__tawveeriInstrumentationRan = new Date().toISOString();
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');

    // The Next.js standalone server does `process.chdir(__dirname)` → cwd is
    // `.next/standalone`, NOT the repo root, so a relative 'scripts/scheduler.js'
    // resolves to a path that does not exist and the spawn silently fails (the
    // first live symptom of ADR-078: no refresh ran). Resolve it against both the
    // cwd and two levels up (.next/standalone → repo root) and pick what exists.
    const candidates = [
      path.join(process.cwd(), 'scripts', 'scheduler.js'),
      path.resolve(process.cwd(), '..', '..', 'scripts', 'scheduler.js'),
    ];
    const schedulerPath = candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
    if (!schedulerPath) {
      (globalThis as Record<string, unknown>).__tawveeriSchedulerError = `scheduler.js not found in: ${candidates.join(', ')}`;
      console.error('[instrumentation] scheduler.js not found (looked in:', candidates.join(', '), ') — skipping');
      return;
    }
    const repoRoot = path.dirname(path.dirname(schedulerPath)); // .../scripts/scheduler.js → repo root
    // Capture the child's stdout/stderr (last ~2KB each) and exit code into globals
    // so the debug endpoint can report WHY the scheduler died — previously stdio was
    // 'ignore', which made an early child crash (e.g. a missing env var → exit(1))
    // completely invisible in production. The child stays a normal child of the
    // long-lived web server (no detach): if the web process is replaced on deploy,
    // the next process respawns it — exactly the behaviour we want.
    const child = spawn(process.execPath, [schedulerPath], {
      cwd: repoRoot,                 // so the scheduler's own `npx tsx scripts/...` resolves
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    const gg = globalThis as Record<string, unknown>;
    const capture = (key: string) => (buf: Buffer) => {
      const prev = (gg[key] as string) || '';
      gg[key] = (prev + buf.toString()).slice(-2000);
    };
    child.stdout?.on('data', capture('__tawveeriSchedulerStdout'));
    child.stderr?.on('data', capture('__tawveeriSchedulerStderr'));
    child.on('exit', (code, signal) => {
      gg.__tawveeriSchedulerExit = { code, signal, at: new Date().toISOString() };
    });
    child.on('error', (e) => {
      gg.__tawveeriSchedulerError = `spawn error: ${e && e.message}`;
      /* best-effort: never propagate to the web server */
    });
    gg.__tawveeriSchedulerSpawned = { pid: child.pid, path: schedulerPath, at: new Date().toISOString() };
    console.log(`[instrumentation] intelligence scheduler spawned (pid ${child.pid}) from ${schedulerPath}`);
  } catch (err) {
    (globalThis as Record<string, unknown>).__tawveeriSchedulerError = err instanceof Error ? err.message : String(err);
    console.error('[instrumentation] scheduler not started (web server unaffected):',
      err instanceof Error ? err.message : err);
  }
}

export const onRequestError = Sentry.captureRequestError;
