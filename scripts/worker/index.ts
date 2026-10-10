// scripts/worker/index.ts
//
// The isolated worker supervisor (2026-09-17 SEV-1 follow-up migration).
// Runs as its own Railway service (railway.worker.toml), never as part of
// tawveeri-main. Owns every heavy background job that used to run inside the
// public web server's process via scripts/scheduler.js + instrumentation.ts.
//
// Design, matched directly to the founder's authorization:
//   - ONE shared Postgres advisory lock (lib/global-lock.ts) — at most one
//     heavy job runs globally at a time, across this process AND any
//     accidental second instance (proven live: a session-pooler connection,
//     not transaction-pooled; two-connection exclusion test passed).
//   - EVERY job runs as a real child OS process via lib/proc-guard.ts, with a
//     measured, evidence-based hard timeout, SIGTERM-then-SIGKILL of the
//     whole process group, never a bare Promise.race.
//   - price_update always jumps the queue ahead of discovery/feed/reobserve/
//     refresh/samsung so a long job can never starve price freshness
//     (founder requirement, section 4).
//   - Master kill switch (WORKER_JOBS_ENABLED) and one switch per job
//     (WORKER_JOB_<NAME>_ENABLED) so restoration can proceed stage by stage
//     via env var only, no redeploy.
//   - Reuses tps_job_state / tps_scheduler_heartbeat / scraping_runs /
//     samsung_delta_watch_runs exactly as before — no schema expansion.

// dotenv MUST run before any local module that reads process.env at its own
// top level (lib/job-state.ts does, for its cooldown/probe constants) — done
// here via require() so it executes before the hoisted `import` statements
// below evaluate their target modules. In production (Railway) this is a
// no-op fallback: env vars are injected directly, no .env file exists — this
// only matters for local dev/testing.
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ path: '.env.local' });
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ path: '.env' });
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { toPoolerDbUrl } = require('../tps-core/pooler-url') as { toPoolerDbUrl: (raw: string) => string };
if (process.env.SUPABASE_DB_URL) process.env.SUPABASE_DB_URL = toPoolerDbUrl(process.env.SUPABASE_DB_URL);

import path from 'path';
import { acquireGlobalLock, type GlobalLock } from './lib/global-lock';
import { runGuarded, type JobOutcome } from './lib/proc-guard';
import { aggregateJobOutcomes, PARTIAL_JOB_EXIT_CODE } from './lib/job-outcome';
import { createRestAdmission } from './lib/rest-admission';
import { RunLifecycle } from './lib/run-lifecycle';
import { collectProcessSnapshot } from './lib/process-snapshot';
import { heartbeat, pressureOk, jobDue, jobDone, admit, reapOrphanedRuns, reapOrphanedSamsungRuns } from './lib/job-state';
import { samsungRuntimeResources } from '../tps-core/samsung-runtime-resources';
import { resolveSamsungDeltaRuntime } from '../tps-core/samsung-delta-runtime';
import { planIdentityRunner } from './lib/identity-runner';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TSX_BIN = require.resolve('tsx/cli');

// ── Master + per-job switches ────────────────────────────────────────────
const JOBS_ENABLED = process.env.WORKER_JOBS_ENABLED === '1';
function jobEnabled(name: string, defaultOn = true): boolean {
  const key = `WORKER_JOB_${name.toUpperCase()}_ENABLED`;
  if (process.env[key] === '0') return false;
  if (process.env[key] === '1') return true;
  return defaultOn;
}

// ── Job registry: name, interval, timeout ceiling (measured evidence,
//    see the migration report for how each ceiling was derived), priority ──
type JobName = 'price_update' | 'discovery' | 'product_recovery' | 'dispatch_sweep' | 'refresh' | 'feed_ingest' | 'reobserve' | 'samsung_delta_watch' | 'manual_trigger' | 'founder_daily' | 'identity_gate';

interface JobDef {
  name: JobName;
  /** Switch default when WORKER_JOB_<NAME>_ENABLED is unset. Omitted = on (every pre-existing job). */
  defaultOn?: boolean;
  intervalMs: number;
  timeoutMs: number;
  /** How to run it: either spawn an existing standalone script (refresh/
   *  feed_ingest/reobserve/samsung), or spawn one of this worker's own
   *  jobs/*.ts entrypoints (price_update/discovery/product_recovery/
   *  dispatch_sweep — the former HTTP self-calls). */
  spawn: () => { cmd: string; args: string[] };
  /** price_update always jumps the queue ahead of everything else so a long
   *  discovery/Samsung run can never starve price freshness. */
  highPriority?: boolean;
}

const tsxJob = (script: string, extraArgs: string[] = []) => () => ({
  cmd: process.execPath,
  args: [TSX_BIN, path.join(REPO_ROOT, script), ...extraArgs],
});
const workerJob = (relScript: string) => () => ({
  cmd: process.execPath,
  args: [TSX_BIN, path.join(__dirname, 'jobs', relScript)],
});

const JOBS: JobDef[] = [
  {
    name: 'price_update',
    intervalMs: parseInt(process.env.INGEST_PRICE_MS || String(6 * 60 * 60 * 1000), 10),
    // Outer backstop only (found live, 2026-09-17: two runs each consumed the
    // full 45min on a single store — 'extra' then 'amazon' — starving every
    // store after it). price-update.ts now bounds EACH store individually
    // (WORKER_PRICE_UPDATE_PER_STORE_TIMEOUT_MS, default 8min) and cascades
    // its own SIGTERM to whichever per-store child is active, so this outer
    // ceiling should rarely fire — sized at 7 stores * 8min + stagger with
    // headroom, not at the old single-store budget.
    timeoutMs: parseInt(process.env.WORKER_PRICE_UPDATE_TIMEOUT_MS || String(75 * 60 * 1000), 10),
    spawn: workerJob('price-update.ts'),
    highPriority: true,
  },
  {
    name: 'discovery',
    intervalMs: parseInt(process.env.INGEST_DISCOVERY_MS || String(12 * 60 * 60 * 1000), 10),
    timeoutMs: parseInt(process.env.WORKER_DISCOVERY_TIMEOUT_MS || String(60 * 60 * 1000), 10),
    spawn: workerJob('discovery.ts'),
  },
  {
    name: 'product_recovery',
    intervalMs: parseInt(process.env.PRODUCT_RECOVERY_MS || String(10 * 60 * 1000), 10),
    timeoutMs: parseInt(process.env.WORKER_PRODUCT_RECOVERY_TIMEOUT_MS || String(10 * 60 * 1000), 10),
    spawn: workerJob('product-recovery.ts'),
  },
  {
    name: 'dispatch_sweep',
    intervalMs: parseInt(process.env.WORKER_DISPATCH_SWEEP_MS || String(5 * 60 * 1000), 10),
    timeoutMs: parseInt(process.env.WORKER_DISPATCH_SWEEP_TIMEOUT_MS || String(10 * 60 * 1000), 10),
    spawn: workerJob('dispatch-sweep.ts'),
  },
  {
    name: 'refresh',
    intervalMs: parseInt(process.env.REFRESH_INTERVAL_MS || String(60 * 60 * 1000), 10),
    timeoutMs: parseInt(process.env.WORKER_REFRESH_TIMEOUT_MS || String(20 * 60 * 1000), 10),
    spawn: tsxJob('scripts/tps-core/refresh-intelligence.ts'),
  },
  {
    name: 'feed_ingest',
    intervalMs: parseInt(process.env.INGEST_FEED_MS || String(6 * 60 * 60 * 1000), 10),
    timeoutMs: parseInt(process.env.WORKER_FEED_INGEST_TIMEOUT_MS || String(20 * 60 * 1000), 10),
    // Kept as the same single-slug-per-invocation script the old scheduler used;
    // the supervisor loop below drives it once per configured feed store.
    spawn: () => ({ cmd: 'noop', args: [] }), // replaced per-store at call time, see runFeedIngest()
  },
  {
    name: 'reobserve',
    // 3 h (was 6 h, 2026-10-10): the job now targets only offers whose refresh restores a comparison (566 such offers measured) and needs ~340 fetches/day to hold the 168 h window.
    intervalMs: parseInt(process.env.REOBSERVE_MS || String(3 * 60 * 60 * 1000), 10),
    timeoutMs: parseInt(process.env.WORKER_REOBSERVE_TIMEOUT_MS || String(15 * 60 * 1000), 10),
    spawn: () => {
      const runtime = resolveSamsungDeltaRuntime(REPO_ROOT, 'scripts/tps-core/reobserve-comparables.ts');
      const limit = parseInt(process.env.REOBSERVE_LIMIT || '60', 10);
      return { cmd: process.execPath, args: [TSX_BIN, runtime.script, '--go', `--limit=${limit}`] };
    },
  },
  {
    name: 'samsung_delta_watch',
    // Observed run durations (samsung_delta_watch_runs, 2026-09-16/17): 7s,
    // 22.5min, 11.9min, 24.2min, 12.4min, and one that never finished (run
    // #10 — the incident). 45min is generous headroom over the highest
    // completed run and is what actually catches a repeat of run #10.
    intervalMs: parseInt(process.env.SAMSUNG_DELTA_WATCH_MS || String(6 * 60 * 60 * 1000), 10),
    timeoutMs: parseInt(process.env.WORKER_SAMSUNG_TIMEOUT_MS || String(45 * 60 * 1000), 10),
    spawn: () => {
      const runtime = resolveSamsungDeltaRuntime(REPO_ROOT);
      return { cmd: process.execPath, args: ['--import', 'tsx', runtime.script] };
    },
  },
  {
    // Consumer for admin "run now" delegation (see run-now/route.ts and
    // jobs/manual-trigger.ts) — a real invocation path discovered during the
    // audit, distinct from the originally-enumerated scheduler.js jobs.
    // High priority: an admin waiting on a manual trigger should not be
    // stuck behind a 45-minute Samsung run any more than price_update should.
    name: 'manual_trigger',
    intervalMs: parseInt(process.env.WORKER_MANUAL_TRIGGER_MS || String(2 * 60 * 1000), 10),
    timeoutMs: parseInt(process.env.WORKER_MANUAL_TRIGGER_TIMEOUT_MS || String(20 * 60 * 1000), 10),
    spawn: workerJob('manual-trigger.ts'),
    highPriority: true,
  },
  {
    // Founder Operating Center (ADR-383): hourly trigger of the self-gated
    // /api/cron/founder-daily route — snapshots + daily/monthly summaries,
    // once per day after the configured Riyadh hour. Light (a few RPCs +
    // one optional model call inside the web service); the 5min ceiling is
    // generous headroom over the route's own 120s budget.
    name: 'founder_daily',
    intervalMs: parseInt(process.env.WORKER_FOUNDER_DAILY_MS || String(60 * 60 * 1000), 10),
    timeoutMs: parseInt(process.env.WORKER_FOUNDER_DAILY_TIMEOUT_MS || String(5 * 60 * 1000), 10),
    spawn: workerJob('founder-daily.ts'),
  },
  {
    // ADR-405 — isolated identity-gate runner. Spawns the SAME refresh orchestrator restricted to its
    // `identity-gate` (+ optionally `projection`, scoped) steps, so a category wave runs while the hourly
    // chain stays fenced (WORKER_JOB_REFRESH_ENABLED=0). DEFAULT OFF behind its own switch; the plan
    // (scripts/worker/lib/identity-runner.ts) refuses categories outside the approved scope. High
    // priority only because it is short and a stale signal is a rollback trigger; it never preempts.
    name: 'identity_gate',
    defaultOn: false,
    // Hourly: a run is ~70 s (signals ~20 s + scoped projection ~20 s + two `npx tsx` start-ups, measured); the stale-signal
    // rollback trigger is 3 h, i.e. two full missed cycles plus queue wait behind the longest in-flight job.
    intervalMs: parseInt(process.env.WORKER_IDENTITY_GATE_MS || String(60 * 60 * 1000), 10),
    timeoutMs: parseInt(process.env.WORKER_IDENTITY_GATE_TIMEOUT_MS || String(15 * 60 * 1000), 10),
    spawn: () => {
      const plan = planIdentityRunner(process.env);
      if (!plan.enabled) throw new Error(`identity_gate refused: ${plan.reason}`);
      return tsxJob('scripts/tps-core/refresh-intelligence.ts', plan.args)();
    },
    highPriority: true,
  },
];

// ── Single-consumer priority queue: at most one job in flight, high-priority
//    jobs (price_update, manual_trigger) always served first among whatever
//    is currently pending — so a long discovery/Samsung run can never starve
//    price freshness or a waiting admin action. ────────────────────────────
const pending = new Set<JobName>();
let currentLock: GlobalLock | null = null;
let currentCancel: ((reason: string) => void) | null = null;
let currentJob: JobName | null = null;
const lifecycle = new RunLifecycle();
const admitRest = createRestAdmission(fetch);

function enqueue(name: JobName) {
  if (lifecycle.stopping) return;
  if (pending.has(name) || currentJob === name) return; // no duplicate queueing
  pending.add(name);
  console.log(`[worker] enqueued ${name} (queue: ${[...pending].join(',') || '-'})`);
}

const HIGH_PRIORITY_JOBS = new Set(JOBS.filter((j) => j.highPriority).map((j) => j.name));

function nextFromQueue(): JobName | null {
  // ADR-405: identity_gate runs ~15 s and its freshness is a mechanical rollback trigger (signals > 3 h), so it is
  // served ahead of every other queued job — including price_update (up to 75 min) — without preempting a running one.
  // Worst-case staleness = its own 60 min cycle + the longest job already in flight, never cycle + two long jobs.
  if (pending.has('identity_gate')) return 'identity_gate';
  for (const name of pending) if (HIGH_PRIORITY_JOBS.has(name)) return name;
  const it = pending.values().next();
  return it.done ? null : it.value;
}

async function runFeedIngest(job: JobDef): Promise<{ outcome: JobOutcome; note: string }> {
  const stores = (process.env.WORKER_FEED_STORES || 'almanea,shaker,najm,alnakheelk,swsg')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const results: string[] = [];
  const outcomes: JobOutcome[] = [];
  for (const slug of stores) {
    if (lifecycle.stopping || currentLock?.isLost()) return { outcome: 'cancelled', note: results.join(' ') };
    const args = [TSX_BIN, path.join(REPO_ROOT, 'scripts/tps-core/ingest-via-provider.ts'), slug];
    const perStoreTimeout = Math.max(60_000, Math.floor(job.timeoutMs / Math.max(1, stores.length)));
    const guarded = runGuarded(process.execPath, args, { cwd: REPO_ROOT, env: process.env, timeoutMs: perStoreTimeout, jobName: `feed_ingest:${slug}` });
    currentCancel = guarded.cancel;
    const r = await guarded.result;
    outcomes.push(r.outcome);
    results.push(`${slug}=${r.outcome}`);
    if (r.outcome === 'cancelled') {
      return { outcome: r.outcome, note: results.join(' ') };
    }
  }
  return { outcome: aggregateJobOutcomes(outcomes), note: results.join(' ') };
}

async function runOneJob(job: JobDef) {
  currentJob = job.name;
  pending.delete(job.name);
  console.log(`[worker] starting ${job.name}`);
  const startedAt = Date.now();

  const lock = await acquireGlobalLock(process.env.SUPABASE_DB_URL!);
  if (!lock) {
    // Should not normally happen (this process is the only holder attempt at
    // a time) — but if a second instance is somehow racing us, defer rather
    // than fight over it.
    console.log(`[worker] ${job.name}: could not acquire global lock (held elsewhere) — re-queueing`);
    pending.add(job.name);
    currentJob = null;
    return;
  }
  currentLock = lock;
  if (lifecycle.stopping) {
    await lock.release();
    currentLock = null;
    currentJob = null;
    return;
  }

  let outcome: JobOutcome = 'failed';
  let note = '';
  let lockLostReason: string | null = null;
  lock.onLost((reason) => {
    lockLostReason = reason;
    console.error(`[worker] ${job.name}: lock connection lost (${reason}) — cancelling job before any further processing`);
    if (currentCancel) currentCancel(`lock lost: ${reason}`);
  });

  try {
    if (job.name === 'feed_ingest') {
      const r = await runFeedIngest(job);
      outcome = lockLostReason ? 'cancelled' : r.outcome;
      note = r.note;
    } else {
      const { cmd, args } = job.spawn();
      const guarded = runGuarded(cmd, args, { cwd: REPO_ROOT, env: process.env, timeoutMs: job.timeoutMs, jobName: job.name, partialExitCode: ['price_update', 'discovery', 'manual_trigger'].includes(job.name) ? PARTIAL_JOB_EXIT_CODE : undefined });
      currentCancel = guarded.cancel;
      const r = await guarded.result;
      outcome = lockLostReason ? 'cancelled' : r.outcome;
      note = r.tail.split('\n').filter(Boolean).slice(-3).join(' | ');
    }
  } catch (err) {
    note = err instanceof Error ? err.message : String(err);
    console.error(`[worker] ${job.name} threw:`, note);
  } finally {
    currentCancel = null;
    const durationS = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[worker] ${job.name} finished: outcome=${outcome} duration=${durationS}s note=${note.slice(0, 300)}`);
    await jobDone(job.name, outcome, note, { startedAtMs: startedAt });
    await heartbeat({ status: `${job.name}:${outcome}` });
    // Confirm termination BEFORE releasing the lock or starting the next job —
    // lock.release() below only proceeds once the guarded child's promise
    // (awaited above) has already resolved, i.e. the process has exited.
    await lock.release();
    currentLock = null;
    currentJob = null;
  }
}

async function supervisorTick() {
  if (currentJob || lifecycle.stopping) return;
  const name = nextFromQueue();
  if (!name) return;
  const job = JOBS.find((j) => j.name === name)!;
  await lifecycle.run(async () => {
    const admission = await admitRest(job.name, process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (lifecycle.stopping) return;
    if (!admission.allowed) {
      pending.delete(job.name); // the ordinary schedule will retry; no hot loop
      console.log(`[worker] ${job.name} deferred: supabase_rest_${admission.reason}`);
      await jobDone(job.name, 'failed', `deferred: supabase_rest_${admission.reason}`);
      return;
    }
    try { await runOneJob(job); } finally { currentJob = null; }
  });
}

// ── Scheduling: identical boot-kick + interval shape to scripts/scheduler.js,
//    but ENQUEUE instead of run-directly, so the priority queue above owns
//    concurrency. ──────────────────────────────────────────────────────────
function scheduleJob(job: JobDef) {
  if (!jobEnabled(job.name, job.defaultOn ?? true)) {
    console.log(`[worker] ${job.name} disabled (WORKER_JOB_${job.name.toUpperCase()}_ENABLED=${job.defaultOn === false ? 'unset/0 — default off' : '0'})`);
    return;
  }
  if (job.name === 'identity_gate') {
    const plan = planIdentityRunner(process.env);
    if (!plan.enabled) { console.error(`[worker] identity_gate NOT scheduled — ${plan.reason}`); return; }
    console.log(`[worker] identity_gate plan: categories=${plan.categories.join(',')} mode=${plan.reason}`);
  }
  const bootDelay = parseInt(process.env.WORKER_FIRST_KICK_DELAY_MS || String(2 * 60 * 1000), 10);
  const jitter = Math.floor(Math.random() * 5 * 60 * 1000);
  setTimeout(async () => {
    if (await jobDue(job.name, job.intervalMs)) enqueue(job.name);
    else console.log(`[governor] boot kick skipped for ${job.name} — last success is fresh`);
  }, bootDelay + jitter);
  setInterval(async () => {
    if (!(await pressureOk(job.name))) return;
    if (job.name === 'discovery' || job.name === 'feed_ingest') {
      if (!(await admit(job.name))) return; // ADR-148 backpressure — discovery/feed only
    }
    enqueue(job.name);
  }, job.intervalMs);
  console.log(`[worker] ${job.name} scheduled — every ${(job.intervalMs / 60000).toFixed(0)}m, timeout ${(job.timeoutMs / 60000).toFixed(0)}m${job.highPriority ? ' [priority]' : ''}`);
}

async function main() {
  console.log(`[worker] starting — pid=${process.pid} JOBS_ENABLED=${JOBS_ENABLED}`);
  const logProcesses = () => {
    try { console.log(`[worker-processes] ${JSON.stringify(collectProcessSnapshot())}`); }
    catch { console.warn('[worker-processes] snapshot unavailable'); }
  };
  logProcesses();
  setInterval(logProcesses, 15 * 60 * 1000);
  await heartbeat('boot');
  // Close out any scraping_runs row left 'running' by a container this
  // fresh boot has replaced (redeploy mid-job) — see job-state.ts's own
  // comment for why this is safe and necessary. Runs before any job is
  // scheduled so a stale row can never be mistaken for still-active work.
  await reapOrphanedRuns();
  // Same recovery, separately, for samsung_delta_watch_runs — a different
  // table with no shared code path to reapOrphanedRuns() above. Added
  // 2026-09-18 specifically because this table had NO orphan recovery at
  // all until now — see job-state.ts's own comment on why that mattered.
  await reapOrphanedSamsungRuns();

  if (!JOBS_ENABLED) {
    console.log('[worker] WORKER_JOBS_ENABLED != 1 — worker is up but will schedule NOTHING. This is the intended state for initial bring-up verification.');
  } else {
    for (const job of JOBS) scheduleJob(job);
  }

  // Supervisor tick — drains the queue one job at a time.
  setInterval(() => { supervisorTick().catch((e) => console.error('[worker] supervisorTick error:', e)); }, 5000);

  // Heartbeat + measured resource usage every tick, per the founder's directive
  // to verify actual limits/usage rather than assume the proposed size is enough.
  setInterval(async () => {
    await heartbeat('tick');
    const res = samsungRuntimeResources();
    console.log(`[worker] heartbeat mem=${res.memoryCurrent ?? '?'}/${res.memoryMax ?? '?'} pids=${res.pidsCurrent ?? '?'}/${res.pidsMax ?? '?'} queue=[${[...pending].join(',')}] running=${currentJob ?? '-'}`);
  }, 60_000);

  process.on('SIGTERM', async () => {
    if (lifecycle.stopping) return;
    console.log('[worker] SIGTERM received');
    pending.clear();
    try {
      await lifecycle.stop(() => currentCancel?.('SIGTERM to worker'));
      // runOneJob releases its lock only after its guarded child has exited.
      process.exit(0);
    } catch {
      process.exit(1);
    }
  });
}

main().catch((err) => {
  console.error('[worker] fatal boot error:', err);
  process.exit(1);
});
