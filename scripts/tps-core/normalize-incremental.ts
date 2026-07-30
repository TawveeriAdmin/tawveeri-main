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

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const defs = Object.values(CATEGORY_DEFS);

  let fetched = 0, staged = 0, canonicals = 0, corroborated = 0;
  for (let i = 0; i < batches; i++) {
    const r = await runSweepUnit(sb, defs, limit);
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
  console.log(`normalize-incremental: backlog ${backlogBefore} → ${backlogAfter}`);
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
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
