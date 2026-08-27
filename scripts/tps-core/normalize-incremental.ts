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
// Supabase's direct host is IPv6-only. Both pg connections below (the backlog probe and
// the ADR-099 lane lock) used SUPABASE_DB_URL raw and died on
// `ENOTFOUND db.<ref>.supabase.co` the moment IPv6 was unavailable — taking the lane lock
// with them, so the serialization guard failed CLOSED and no sweep could run at all.
// CLAUDE.md already requires routing through the pooler; this is that rule applied to the
// guard itself.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { toPoolerDbUrl } = require("./pooler-url.js") as { toPoolerDbUrl: (raw: string) => string };

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
    const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL || ""), ssl: { rejectUnauthorized: false } });
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
  // ── --dry-run (2026-07-31) ────────────────────────────────────────────────────────
  // Performs the FULL read, detect, classify, identity-key and corroboration logic and
  // writes NOTHING: no cursor advance, no staging, no write_ac_batch. Required by the
  // production gate before any backfill — CLAUDE.md's "--dry-first" rule had no
  // implementation, so "dry first" was unenforceable.
  //
  // The cursor deliberately does not move: a dry run that advanced it would silently
  // consume work the real run then never sees.
  const dryRun = process.argv.includes("--dry-run");
  // `--replay-from <rawId>` (DRY ONLY) reads from a raw id instead of the store cursor, so a
  // dry run can measure observations already behind it. Required here: all 103,106 discovery
  // observations sit behind their cursors, so a cursor-relative dry run reports 0.
  const rf = process.argv.indexOf("--replay-from");
  const replayFrom = rf >= 0 ? Number(process.argv[rf + 1]) : undefined;
  if (replayFrom != null && !Number.isFinite(replayFrom)) throw new Error("--replay-from needs a numeric raw id");
  if (replayFrom != null && !dryRun) throw new Error("--replay-from requires --dry-run");

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
  // A dry run mutates nothing, so it must NOT take the lane — holding it would block the
  // hourly chain for the duration of a purely diagnostic run.
  if (process.env.NORMALIZE_LANE_LOCK !== "0" && !dryRun) {
    try {
      lockClient = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL || ""), ssl: { rejectUnauthorized: false } });
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
  // Dry-run accounting. Skip reasons are the engine's own classification, not an estimate.
  const dryTotals = { detected: 0, valid: 0, lowConfidence: 0, invalid: 0, singleStore: 0, normalized: 0, matches: 0, prices: 0, priceTransitionsRejected: 0, keys: new Set<string>() };
  for (let i = 0; i < effBatches; i++) {
    const r = await runSweepUnit(sb, defs, limit, onlyStores, dryRun, replayFrom);
    fetched += r.normalize.fetched;
    staged += r.normalize.staged;
    for (const [cat, c] of Object.entries(r.normalize.byCategory)) {
      dryTotals.detected += c.detected; dryTotals.valid += c.valid;
      dryTotals.lowConfidence += c.lowConfidence; dryTotals.invalid += c.invalid;
      for (const k of c.touched) dryTotals.keys.add(`${cat}|${k}`);
    }
    for (const m of Object.values(r.corroborate)) {
      canonicals += m.canonicalsWritten;
      corroborated += m.corroborated;
      dryTotals.singleStore += m.singleStore; dryTotals.normalized += m.normalized;
      dryTotals.matches += m.matches; dryTotals.prices += m.prices;
      dryTotals.priceTransitionsRejected += m.priceTransitionsRejected;
    }
    // Cursors have caught up — stop early rather than burn empty sweeps.
    // In DRY mode the cursor never advances, so every batch would re-read the SAME rows;
    // one pass is the whole measurable signal and repeating it would inflate every total.
    if (r.normalize.fetched === 0 || dryRun) break;
  }

  if (dryRun) {
    console.log(`\n═══ DRY RUN — NOTHING WAS WRITTEN ═══${onlyStores ? ` [stores ${onlyStores.join(",")}]` : ""}`);
    console.log(`  eligible observations read (one sweep, limit ${limit})  ${fetched}`);
    console.log(`  would be STAGED (detected by a category plugin)         ${staged}`);
    console.log(`  would receive tps_identity_key (valid tier)             ${dryTotals.valid}`);
    console.log(`  distinct identity keys touched                          ${dryTotals.keys.size}`);
    console.log(`  would be NORMALIZED (normalized_product_observations)   ${dryTotals.normalized}`);
    console.log(`  canonicals that WOULD be written                        ${canonicals}`);
    console.log(`    of which corroborated (>=2 stores, comparable)        ${corroborated}`);
    console.log(`    of which single-store (Layer 2, resolved-single)      ${dryTotals.singleStore}`);
    console.log(`  product_matches that WOULD be written                   ${dryTotals.matches}`);
    console.log(`  price_history rows that WOULD be appended               ${dryTotals.prices}`);
    console.log(`  price transitions REJECTED (implausible, quarantined)    ${dryTotals.priceTransitionsRejected}`);
    console.log(`  SKIPPED, by explicit reason:`);
    console.log(`    read but not detected by any plugin                   ${Math.max(0, fetched - dryTotals.detected)}`);
    console.log(`    detected but low confidence                           ${dryTotals.lowConfidence}`);
    console.log(`    detected but invalid identity tier                    ${dryTotals.invalid}`);
    console.log(`  cursor NOT advanced · staging NOT written · write_ac_batch NOT called`);
    try { await lockClient?.end(); } catch { /* ignore */ }
    return;
  }

  const backlogAfter = (await ask<{ backlog: string }>(BACKLOG_SQL))[0].backlog;
  console.log(`normalize-incremental${onlyStores ? ` [stores ${onlyStores.join(",")}]` : ""}${adaptive ? ` [adaptive batches=${effBatches}]` : ""}: backlog ${backlogBefore} → ${backlogAfter}`);
  console.log(`  observations processed=${fetched} staged=${staged}`);
  console.log(`  corroborated keys=${corroborated} canonicals written=${canonicals}`);
  // GUARDRAIL (ADR-251): staged→normalized conversion, printed on every real run. The 10×
  // ingestion collapse hid for a week because the sweep looked healthy (cursors advanced,
  // staging grew) while corroborate silently lost the newest rows to PostgREST's 1,000-row
  // response cap. This line makes that class of loss visible in the scheduler log the day
  // it starts: staged>0 with normalized«staged is the alarm shape.
  console.log(`  normalized observations written=${dryTotals.normalized} (staged this run=${staged})`);

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
