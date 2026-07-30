// scripts/tps-core/normalize-incremental.ts
// ─────────────────────────────────────────────────────────────────────────────
// INCREMENTAL NORMALIZATION (ADR-069) — the missing first link in the chain.
//
// Ingestion runs continuously from an external trigger, but NOTHING converted
// those observations into identities. `/api/cron/tps-progressive` exists and does
// exactly this work, yet the dispatcher only knows `discovery` and `price_update`
// job types — and `scraping_schedules` is empty anyway. So the identity layer only
// ever grew when a human remembered to run `bulk-backfill`, and every product
// ingested in between was invisible to customers indefinitely.
//
// This is the same failure class as ADR-062 (derived layers drifting from
// evidence) but one layer earlier and more damaging: there, existing products went
// stale; here, NEW products never appear at all.
//
// Uses the progressive engine's durable per-store cursors, so each run processes
// only what arrived since the last one — unlike `bulk-backfill`, which rescans all
// ~142k observations and is far too heavy to run hourly.
//
// Bounded, idempotent, resumable. Usage:
//   npx tsx scripts/tps-core/normalize-incremental.ts [--batches 6] [--limit 500]
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { CATEGORY_DEFS } from "./category-registry";
import { runSweepUnit } from "./progressive-engine";
import { assertFingerprint } from "./tps-batch";

const arg = (name: string, dflt: number) => {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : dflt;
};

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const batches = Math.min(20, arg("batches", 6));
  const limit = Math.min(500, arg("limit", 500));   // engine hard-bound: <=500/run
  // `--stores 5,1` narrows the sweep. Omitted = every store, unchanged behaviour.
  // Needed to attribute a per-store delta: the equal-share budget drains every lagging
  // store in the same pass, so a whole-fleet drain cannot say what any one store was worth.
  const si = process.argv.indexOf("--stores");
  const onlyStores = si >= 0
    ? String(process.argv[si + 1] ?? "").split(",").map((s) => Number(s.trim())).filter(Number.isFinite)
    : undefined;
  if (onlyStores && !onlyStores.length) throw new Error("--stores given but empty");

  // Measure the backlog first, so the run reports what it actually cleared
  // rather than just that it ran.
  // Short-lived connections. The client used to be opened here and left idle for the whole
  // sweep, which now takes minutes rather than seconds after the throughput fix — long
  // enough for the server to drop it, so a successful run ended in ECONNRESET and reported
  // nothing. Connect, ask, disconnect.
  const ask = async <T extends Record<string, unknown>>(sql: string): Promise<T[]> => {
    const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
    await c.connect();
    try { return (await c.query<T>(sql)).rows; } finally { await c.end(); }
  };
  // THE BACKLOG METRIC WAS WRONG, and every session that quoted it was misled.
  // It used to be `id > (select max(raw_obs_id) from tps_identity_staging)` — "rows newer
  // than the newest row ANY store has staged". Because cursors are per-store, one store
  // running ahead (extra, id 645,528) pushes that maximum up and makes the number collapse
  // toward zero while other stores are hundreds of thousands of rows behind. Measured
  // 2026-07-30: this reported "backlog 0 → 11" in the same run where jarir was 51,088 and
  // almanea 322,136 rows behind. It is not a conservative estimate; it is the wrong
  // question.
  //
  // True pending = the sum of every store's own cursor lag.
  const BACKLOG_SQL = `select coalesce(sum((select count(*) from raw_observations o
                                             where o.store_id = c.store_id and o.id > c.last_raw_id)), 0)::text backlog
                         from tps_progress_cursors c where c.category = '_all_'`;
  const backlogBefore = Number((await ask<{ backlog: string }>(BACKLOG_SQL))[0].backlog);

  // ADR-148 — NORMALIZATION CAPACITY MUST TRACK THE QUEUE, not a constant.
  // The hourly chain ran a fixed `--batches 6` (~3,000 observations) whatever the backlog
  // was. Ingestion writes in bursts (a feed run lands thousands at once), so a constant
  // drain rate below the burst rate means the queue grows without bound — which is how
  // almanea reached 320,386 rows behind while the chain reported success every hour.
  // With `--adaptive` the batch count scales with the measured backlog, so a quiet system
  // stays cheap and a backed-up one is allowed to catch up. Bounded by the engine's own
  // 20-batch ceiling, so this can never become an unbounded writer.
  const adaptive = process.argv.includes("--adaptive");
  const effBatches = adaptive
    ? Math.min(20, backlogBefore > 20_000 ? 20 : backlogBefore > 5_000 ? 12 : batches)
    : batches;

  // ── NORMALIZATION LANE LEASE (ADR-148) ────────────────────────────────────────────
  // ADR-099's outage came from concurrent heavy pipeline writers, and the guards meant to
  // prevent it (`refreshRunning` et al.) are module-level booleans — blind across
  // processes. Making normalization adaptive (up to 20 batches) raised the value of the
  // hourly chain overlapping a manual drain, so the lane now has a real, cross-process
  // lease: a Postgres SESSION advisory lock held on a dedicated connection for the run.
  // It releases automatically if the process dies, because the connection dies with it —
  // no stale lock can wedge the pipeline.
  //
  // ASYMMETRIC BY DESIGN, and this matters:
  //   • `--yield-if-locked` (the hourly chain) SKIPS when the lane is busy. A skipped tick
  //     is free: the next one recomputes from the same cursors.
  //   • a manual drain does NOT pass it, so it always proceeds. A drain that silently
  //     no-oped would look identical to a drain that finished, which is exactly the class
  //     of invisible failure this whole investigation exists to remove.
  // Both sides still ACQUIRE the lease when free, so either can be yielded to.
  // Fails OPEN: any error acquiring the lease lets the run proceed.
  // REVERSIBLE: NORMALIZE_LANE_LOCK=0 disables the lease entirely.
  const LANE_KEY = 814_8148;
  let lockClient: Client | null = null;
  let haveLane = false;
  if (process.env.NORMALIZE_LANE_LOCK !== "0") {
    try {
      lockClient = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
      await lockClient.connect();
      haveLane = (await lockClient.query<{ ok: boolean }>(`select pg_try_advisory_lock($1) ok`, [LANE_KEY])).rows[0].ok;
    } catch (e) {
      console.warn(`  lane lease unavailable (${e instanceof Error ? e.message : e}) — proceeding`);
      haveLane = true;                      // fail open
    }
    if (!haveLane && process.argv.includes("--yield-if-locked")) {
      console.log("normalize-incremental: another normalizer holds the lane — skipping this tick");
      try { await lockClient?.end(); } catch { /* ignore */ }
      return;
    }
    if (!haveLane) console.warn("  WARNING: lane is held by another normalizer — proceeding anyway (manual run)");
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const defs = Object.values(CATEGORY_DEFS);

  let fetched = 0, staged = 0, canonicals = 0, corroborated = 0;
  for (let i = 0; i < effBatches; i++) {
    const r = await runSweepUnit(sb, defs, limit, onlyStores);
    fetched += r.normalize.fetched;
    staged += r.normalize.staged;
    for (const m of Object.values(r.corroborate)) {
      canonicals += m.canonicalsWritten;
      corroborated += m.corroborated;
    }
    // Cursors have caught up — stop early rather than burn empty sweeps.
    if (r.normalize.fetched === 0) break;
  }

  const backlogAfter = (await ask<{ backlog: string }>(BACKLOG_SQL))[0].backlog;
  console.log(`normalize-incremental${onlyStores ? ` [stores ${onlyStores.join(",")}]` : ""}${adaptive ? ` [adaptive batches=${effBatches}]` : ""}: backlog ${backlogBefore} → ${backlogAfter}`);
  console.log(`  observations processed=${fetched} staged=${staged}`);
  console.log(`  corroborated keys=${corroborated} canonicals written=${canonicals}`);

  // DELIVERY GUARANTEE (2026-07-30): the aggregate "backlog" hides which STORE is behind,
  // and it is not a queue position — sweeps advance a cursor PER STORE, so a single lagging
  // store can leave freshly-ingested offers unnormalized for days while the headline number
  // looks healthy. An overlap-seeded Noon experiment was unmeasurable for exactly this
  // reason: 600 observations written, 0 staged, because Noon's cursor sat 15,481 rows back.
  // Per-store lag is now printed on every run, so the condition is visible the moment it
  // appears rather than discovered by a failed experiment.
  const lag = (await ask<{ store_id: number; behind: string }>(
    `select c.store_id, (select count(*) from raw_observations o
                         where o.store_id = c.store_id and o.id > c.last_raw_id)::text behind
       from tps_progress_cursors c where c.category = '_all_' order by 2 desc`))
    .filter((x) => Number(x.behind) > 0).map((x) => ({ store_id: x.store_id, behind: Number(x.behind) }));
  if (lag.length) {
    console.log('  per-store lag (rows behind the cursor):');
    for (const r of lag) console.log(`    store ${String(r.store_id).padStart(3)}  ${String(r.behind).padStart(8)} behind`);
  } else {
    console.log('  per-store lag: all stores current');
  }
  // Release the lane. Best-effort: the lock is session-scoped, so closing the connection
  // (or the process dying) releases it regardless.
  try { await lockClient?.end(); } catch { /* ignore */ }
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
