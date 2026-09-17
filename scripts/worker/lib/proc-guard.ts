// scripts/worker/lib/proc-guard.ts
//
// WHY: the incident that triggered this worker (Samsung delta-watch run #10,
// 2026-09-17) proved scripts/scheduler.js has NO hard timeout anywhere for any
// spawned child — every job waits on `close` forever. The founder's directive
// is explicit: "A Promise timeout alone is insufficient... enforce graceful
// cancellation followed by bounded forced termination, including descendants
// and Chromium... confirm termination before releasing the execution slot."
//
// This wraps every heavy job's child process with:
//   1. `detached: true` on spawn — on Linux this makes the child the leader of
//      its OWN process group, so signalling `-pid` (negative pid) reaches the
//      child AND every descendant it spawns that does not itself detach
//      (verified against this codebase: samsung-delta-watch.ts's own nested
//      spawns of normalize-incremental.ts / build-tps-projection.ts do not
//      pass `detached`, so they inherit this process group and die with it).
//   2. On timeout: SIGTERM the whole group first (graceful), wait `graceMs`,
//      then SIGKILL the whole group if it hasn't exited (bounded forced
//      termination).
//   3. The promise only resolves once the child has actually exited — the
//      caller never releases the global lock or starts another job before
//      termination is confirmed.
//
// NOT YET LIVE-VALIDATED: process-group signalling semantics must be
// confirmed on the actual Railway/Linux container as part of the worker's
// own bring-up validation (a local Windows dev shell cannot exercise POSIX
// process groups the same way) — this is called out explicitly in the
// implementation report, not asserted as already proven.

import { spawn, SpawnOptionsWithoutStdio } from 'child_process';

export type JobOutcome = 'success' | 'failed' | 'timeout' | 'cancelled' | 'spawn_error';

export interface GuardedResult {
  outcome: JobOutcome;
  code: number | null;
  signal: NodeJS.Signals | null;
  /** Last ~2000 chars of combined stdout+stderr, for diagnostics on failure. */
  tail: string;
  durationMs: number;
}

export interface GuardedRun {
  result: Promise<GuardedResult>;
  /** Ask the job to stop gracefully now (SIGTERM), then SIGKILL after the
   *  grace period if it hasn't exited. Safe to call multiple times. */
  cancel: (reason: string) => void;
}

export interface RunGuardedOptions extends SpawnOptionsWithoutStdio {
  timeoutMs: number;
  graceMs?: number;
  jobName: string;
}

export function runGuarded(cmd: string, args: string[], opts: RunGuardedOptions): GuardedRun {
  const graceMs = opts.graceMs ?? 30_000;
  const startedAt = Date.now();
  let cancelledReason: string | null = null;
  let timedOut = false;
  let settled = false;

  const { timeoutMs, graceMs: _g, jobName, ...spawnOpts } = opts;
  const child = spawn(cmd, args, { ...spawnOpts, detached: true });

  let tail = '';
  const capture = (buf: Buffer) => { tail = (tail + buf.toString()).slice(-2000); };
  child.stdout?.on('data', capture);
  child.stderr?.on('data', capture);

  const killGroup = (sig: NodeJS.Signals) => {
    if (child.pid == null) return;
    try {
      process.kill(-child.pid, sig); // negative pid = whole process group (Linux/POSIX)
    } catch {
      try { child.kill(sig); } catch { /* process may already be gone */ }
    }
  };

  let killTimer: NodeJS.Timeout | null = null;
  const beginForcedTermination = () => {
    killGroup('SIGTERM');
    killTimer = setTimeout(() => {
      if (!settled) {
        console.error(`[proc-guard] ${jobName}: SIGTERM did not stop the process tree within ${graceMs}ms — SIGKILL`);
        killGroup('SIGKILL');
      }
    }, graceMs);
  };

  const timeoutTimer = setTimeout(() => {
    timedOut = true;
    console.error(`[proc-guard] ${jobName}: exceeded ${timeoutMs}ms — sending SIGTERM to process group`);
    beginForcedTermination();
  }, timeoutMs);

  const result = new Promise<GuardedResult>((resolve) => {
    child.on('close', (code, signal) => {
      settled = true;
      clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      const outcome: JobOutcome = cancelledReason ? 'cancelled' : timedOut ? 'timeout' : code === 0 ? 'success' : 'failed';
      resolve({ outcome, code, signal, tail, durationMs: Date.now() - startedAt });
    });
    child.on('error', (err) => {
      settled = true;
      clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      tail = (tail + `\n[spawn error] ${err?.message || err}`).slice(-2000);
      resolve({ outcome: 'spawn_error', code: null, signal: null, tail, durationMs: Date.now() - startedAt });
    });
  });

  return {
    result,
    cancel: (reason: string) => {
      if (settled || cancelledReason) return;
      cancelledReason = reason;
      console.error(`[proc-guard] ${jobName}: cancelled (${reason}) — sending SIGTERM to process group`);
      beginForcedTermination();
    },
  };
}
