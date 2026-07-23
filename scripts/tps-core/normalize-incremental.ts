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
  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const before = await pg.query<{ backlog: string }>(
    `select count(*)::text backlog from raw_observations
     where id > (select coalesce(max(raw_obs_id), 0) from tps_identity_staging)`
  );
  const backlogBefore = Number(before.rows[0].backlog);

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

  const after = await pg.query<{ backlog: string }>(
    `select count(*)::text backlog from raw_observations
     where id > (select coalesce(max(raw_obs_id), 0) from tps_identity_staging)`
  );
  await pg.end();

  console.log(`normalize-incremental: backlog ${backlogBefore} → ${after.rows[0].backlog}`);
  console.log(`  observations processed=${fetched} staged=${staged}`);
  console.log(`  corroborated keys=${corroborated} canonicals written=${canonicals}`);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
