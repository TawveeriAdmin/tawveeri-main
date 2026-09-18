// scripts/worker/lib/job-state.ts
//
// Direct TypeScript port of the governor helpers from scripts/scheduler.js
// (heartbeat / pressureOk / jobDue / jobDone / admit / rowsBehind), reusing
// the SAME tables (tps_scheduler_heartbeat, tps_job_state, tps_progress_cursors)
// per the founder's directive to reuse existing job-state mechanisms rather
// than expand schema. Behavior is intentionally identical to the proven
// original except:
//   - jobDone/jobFailed now accept a JobOutcome so 'timeout'/'cancelled' are
//     recorded in last_note (a free-text column — no schema change) instead
//     of being indistinguishable from an ordinary failure.
//   - every DB touch here uses its own short-lived Client (never the global
//     lock's session connection), exactly as scheduler.js already did.

import { newPgClient, type PgClient } from './pg-client';
import type { JobOutcome } from './proc-guard';

function dbUrl(): string | null {
  return process.env.SUPABASE_DB_URL || null;
}

let hbClient: PgClient | null = null;
export async function heartbeat(field: 'boot' | 'tick' | { status: string }): Promise<void> {
  try {
    const url = dbUrl();
    if (!url) return;
    if (!hbClient) {
      hbClient = newPgClient({ connectionString: url, ssl: { rejectUnauthorized: false } });
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
    } else {
      await hbClient.query(`update tps_scheduler_heartbeat set last_refresh_at=now(), last_refresh_status=$1 where id=1`, [field.status]);
    }
  } catch { /* heartbeat failure must never affect the worker */ }
}

const BOOT_AT = Date.now();
const BOOT_COOLDOWN_MS = parseInt(process.env.WORKER_BOOT_COOLDOWN_MS || String(2 * 60 * 1000), 10);
const PRESSURE_PROBE_MS = parseInt(process.env.PRESSURE_PROBE_SLOW_MS || '1500', 10);

/** Same fail-CLOSED discipline as scheduler.js's pressureOk: unprovable DB
 *  comfort = no background work. The worker's own boot cooldown is shorter
 *  than the old in-process scheduler's (2m vs 10m) because the worker never
 *  competes with cold-cache public traffic the way tawveeri-main did. */
export async function pressureOk(kind: string): Promise<boolean> {
  if (Date.now() - BOOT_AT < BOOT_COOLDOWN_MS) {
    console.log(`[governor] ${kind} deferred — post-boot cooldown (${Math.round((BOOT_COOLDOWN_MS - (Date.now() - BOOT_AT)) / 60000)}m left)`);
    return false;
  }
  const url = dbUrl();
  if (!url) return true;
  try {
    const c = newPgClient({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
    const t0 = Date.now();
    await c.connect();
    await c.query('select 1');
    const ms = Date.now() - t0;
    try { await c.end(); } catch { /* ignore */ }
    if (ms > PRESSURE_PROBE_MS) {
      console.log(`[governor] ${kind} deferred — DB probe ${ms}ms > ${PRESSURE_PROBE_MS}ms (pressure)`);
      return false;
    }
    return true;
  } catch (e) {
    console.log(`[governor] ${kind} deferred — DB probe failed (${(e as Error)?.message || e})`);
    return false;
  }
}

export async function jobDue(job: string, intervalMs: number): Promise<boolean> {
  const url = dbUrl();
  if (!url) return false;
  try {
    const c = newPgClient({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
    await c.connect();
    await c.query(`create table if not exists tps_job_state (
      job text primary key, last_success_at timestamptz, last_note text, updated_at timestamptz not null default now())`);
    const { rows } = await c.query('select last_success_at from tps_job_state where job=$1', [job]);
    try { await c.end(); } catch { /* ignore */ }
    const lastRaw = rows[0]?.last_success_at as string | undefined;
    const last = lastRaw ? new Date(lastRaw).getTime() : null;
    if (last == null) return true;
    return Date.now() - last >= intervalMs * 0.8;
  } catch (e) {
    console.log(`[governor] jobDue(${job}) unknown (${(e as Error)?.message || e}) — treating as NOT due`);
    return false;
  }
}

/** Records a completed run. For anything other than a clean success, `note`
 *  should start with the JobOutcome so history is queryable
 *  (`last_note like 'timeout:%'` etc.) without a schema change. */
export async function jobDone(job: string, outcome: JobOutcome, note?: string): Promise<void> {
  const url = dbUrl();
  if (!url) return;
  try {
    const c = newPgClient({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
    await c.connect();
    await c.query(`create table if not exists tps_job_state (
      job text primary key, last_success_at timestamptz, last_note text, updated_at timestamptz not null default now())`);
    const fullNote = `${outcome}${note ? ': ' + note : ''}`.slice(0, 200);
    if (outcome === 'success') {
      await c.query(`insert into tps_job_state (job, last_success_at, last_note, updated_at) values ($1, now(), $2, now())
                     on conflict (job) do update set last_success_at=now(), last_note=$2, updated_at=now()`, [job, fullNote]);
    } else {
      // Do NOT advance last_success_at on failure/timeout/cancellation — jobDue must keep
      // treating the job as due so the next tick retries it, not wait a full interval.
      await c.query(`insert into tps_job_state (job, last_note, updated_at) values ($1, $2, now())
                     on conflict (job) do update set last_note=$2, updated_at=now()`, [job, fullNote]);
    }
    try { await c.end(); } catch { /* ignore */ }
  } catch { /* best-effort */ }
}

const BP_HIGH = parseInt(process.env.INGEST_BACKPRESSURE_HIGH || '500000', 10);
const BP_LOW = parseInt(process.env.INGEST_BACKPRESSURE_LOW || '400000', 10);
let bpTripped = false;

async function rowsBehind(): Promise<number | null> {
  const url = dbUrl();
  if (!url) return null;
  const c = newPgClient({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await c.connect();
    const { rows } = await c.query(`select coalesce(sum((select count(*) from raw_observations o
                                     where o.store_id = k.store_id and o.id > k.last_raw_id)), 0)::text n
                                    from tps_progress_cursors k where k.category = '_all_'`);
    return Number(rows[0].n);
  } catch (e) {
    console.error('[backpressure] probe failed:', (e as Error)?.message || e);
    return null;
  } finally { try { await c.end(); } catch { /* ignore */ } }
}

/** Identical hysteresis behavior to scheduler.js's admit(). */
export async function admit(kind: string): Promise<boolean> {
  if (BP_HIGH <= 0) return true;
  const n = await rowsBehind();
  if (n === null) return true;
  if (bpTripped && n <= BP_LOW) {
    bpTripped = false;
    console.log(`[backpressure] rows-behind ${n} <= low-water ${BP_LOW} — resuming ingestion`);
  } else if (!bpTripped && n > BP_HIGH) {
    bpTripped = true;
    console.log(`[backpressure] rows-behind ${n} > high-water ${BP_HIGH} — deferring ${kind}`);
  }
  if (bpTripped) {
    console.log(`[backpressure] ${kind} deferred — rows-behind ${n}, resumes at <= ${BP_LOW}`);
    return false;
  }
  return true;
}

// ── Boot-time orphan recovery ────────────────────────────────────────────
//
// WHY (found live, 2026-09-17, same session): a git push mid-run triggers a
// Railway container swap for this service — same as any other deploy. The
// OLD container is replaced before its SIGTERM cascade (see price-update.ts)
// can finish the async DB write that closes the in-flight scraping_runs
// row, so the row is left 'running' with finished_at=null even though the
// container (and every process in it, cleanly, per Railway's own container
// teardown) is gone. This is a smaller-scale repeat of exactly the class of
// bug that orphaned samsung_delta_watch_runs #10 during the original SEV-1
// (there the cause was resource exhaustion inside tawveeri-main; here it's
// an ordinary code deploy) — the fix is the same shape: on boot, a FRESH
// process can safely assume any 'running' row older than a generous
// threshold belongs to a container that no longer exists (this worker never
// runs more than one replica, and no job is allowed to run longer than its
// own configured per-store/per-job timeout), and close it accurately.
//
// This runs once at boot, before any job is scheduled — it must never touch
// a row a still-alive process might be updating, hence the generous
// threshold (comfortably longer than any single per-store timeout).
const STALE_RUN_THRESHOLD_MS = parseInt(process.env.WORKER_STALE_RUN_THRESHOLD_MS || String(20 * 60 * 1000), 10);

export async function reapOrphanedRuns(): Promise<void> {
  const url = dbUrl();
  if (!url) return;
  const c = newPgClient({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await c.connect();
    const cutoff = new Date(Date.now() - STALE_RUN_THRESHOLD_MS).toISOString();
    const { rows } = await c.query(
      `update scraping_runs
       set status='failed', finished_at=now(), duration_ms=extract(epoch from (now()-started_at))*1000,
           errors_count=coalesce(errors_count,0)+1,
           error_summary=coalesce(error_summary,'{}'::jsonb) || $2::jsonb
       where status='running' and started_at < $1
       returning id, store_name`,
      [cutoff, JSON.stringify({ reason: 'orphaned_boot_reap', detail: 'Row was still running when this worker process booted, older than the stale-run threshold — the container that owned it is gone. Closed automatically at boot.' })]
    );
    if (rows.length) {
      console.log(`[worker] boot reap: closed ${rows.length} orphaned scraping_runs row(s): ${rows.map((r) => r.store_name).join(', ')}`);
    }
  } catch (e) {
    console.error('[worker] boot reap failed:', (e as Error)?.message || e);
  } finally {
    try { await c.end(); } catch { /* ignore */ }
  }
}

// ── Samsung delta-watch orphan recovery ──────────────────────────────────
//
// WHY (found live, 2026-09-18, founder review of the production-recovery
// mandate): reapOrphanedRuns() above only ever covered `scraping_runs`.
// `samsung_delta_watch_runs` — the exact table samsung_delta_watch_runs #10
// belonged to during the original SEV-1 — has NO equivalent recovery at all.
// Confirmed by reading samsung-delta-watch.ts directly: it DOES catch
// SIGTERM, but only to `process.exit(143)` immediately — it never attempts
// to close its own row first, and a SIGKILL (proc-guard's escalation after
// the grace period) gives no chance to run any cleanup code either way. So a
// proc-guard-triggered timeout or a mid-run deploy leaves this table's row
// stuck 'running' forever, identically to the original incident, even
// though the OS-level process tree is now safely killed (SIGTERM/SIGKILL,
// and tini now reaps any reparented descendants of its own nested spawn
// chain — samsung-delta-watch.ts -> samsung-worker-child.ts -> a further
// child). Process-level safety and database-bookkeeping safety are two
// different guarantees; this closes the second one for this table
// specifically, mirroring reapOrphanedRuns()'s exact pattern.
//
// Threshold: Samsung's own configured outer timeout (WORKER_SAMSUNG_TIMEOUT_MS)
// is 45 minutes; this threshold must exceed it with real margin so a
// genuinely-still-running run is never touched. Reversible via env var.
const SAMSUNG_STALE_RUN_THRESHOLD_MS = parseInt(process.env.WORKER_SAMSUNG_STALE_RUN_THRESHOLD_MS || String(60 * 60 * 1000), 10);

export async function reapOrphanedSamsungRuns(): Promise<void> {
  const url = dbUrl();
  if (!url) return;
  const c = newPgClient({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await c.connect();
    const cutoff = new Date(Date.now() - SAMSUNG_STALE_RUN_THRESHOLD_MS).toISOString();
    const { rows } = await c.query(
      `update samsung_delta_watch_runs
       set status='failed', finished_at=now(),
           notes=coalesce(notes,'{}'::jsonb) || $2::jsonb
       where status='running' and started_at < $1
       returning id, run_id`,
      [cutoff, JSON.stringify({ reason: 'orphaned_boot_reap', detail: 'Row was still running when this worker process booted, older than the stale-run threshold — the container/process that owned it is gone. Closed automatically at boot.' })]
    );
    if (rows.length) {
      console.log(`[worker] boot reap: closed ${rows.length} orphaned samsung_delta_watch_runs row(s): ${rows.map((r) => r.id).join(', ')}`);
    }
  } catch (e) {
    console.error('[worker] samsung boot reap failed:', (e as Error)?.message || e);
  } finally {
    try { await c.end(); } catch { /* ignore */ }
  }
}
