// scripts/tps-core/backfill-gap-scan.ts
// ─────────────────────────────────────────────────────────────────────────────
// ONE-TIME, EXPLICITLY-LAUNCHED, governor-paced historical gap backfill (ADR-351).
//
// `normalizeSweep`'s new trailing gap re-scan (progressive-engine.ts) self-heals any
// raw_observations row within TRAILING_GAP_WINDOW (5,000 ids) behind a store's cursor that
// never produced a tps_identity_staging row in any category — this closes the durability
// bug (out-of-order commits on the `raw_observations.id` sequence under concurrent writers)
// for all FUTURE occurrences, automatically, on every normal sweep.
//
// It does NOT reach further back than that window. Measured live (2026-09-13, Samsung KSA):
// after the fix + one real sweep, 86 of Samsung's distinct product URLs were STILL unstaged,
// spanning raw_observations ids 611,216–2,593,500 — i.e. up to ~2 MILLION ids behind the
// current cursor, far older than this specific concurrency bug and pre-dating it (some
// likely predate certain category plugins even existing, e.g. ADR-061's mobile registration).
// This is a legacy backlog, not an ongoing symptom — a separate, one-time, wider pass is the
// correct tool, exactly like the existing `seed-current-offers.ts` precedent for the same
// class of "the hot sweep won't look back this far, so an explicit human-launched job does."
//
// SAFE BY DESIGN:
//   - Read-only against `tps_progress_cursors` — NEVER writes to it. The forward cursor is
//     untouched; this only fills in staging rows for content already behind it.
//   - Idempotent — `tps_identity_staging` upserts on (category, raw_obs_id); re-running is safe.
//   - Bounded — a single `--store` is required (no whole-fleet mode), keyset-paginated in
//     small batches, paced between batches, with the same gh-ost-style pressure probe
//     `seed-current-offers.ts` uses (any slow `select 1` pauses the run).
//   - --dry-run computes and reports without writing anything.
//
// Usage:
//   npx tsx scripts/tps-core/backfill-gap-scan.ts --store 6 --dry-run
//   npx tsx scripts/tps-core/backfill-gap-scan.ts --store 6 [--batch 2000] [--pace-ms 1000] [--from-id 0]
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { CATEGORY_DEFS } from "./category-registry";
import { adaptRow, extractPrice, extractImage } from "./progressive-engine";
import { isValidGtin } from "../../src/lib/enrichment/icecat";
import { assertFingerprint } from "./tps-batch";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { toPoolerDbUrl } = require("./pooler-url.js") as { toPoolerDbUrl: (raw: string) => string };

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] ?? null : null;
};
const has = (name: string) => process.argv.includes(`--${name}`);
const PRESSURE_SLOW_MS = parseInt(process.env.PRESSURE_PROBE_SLOW_MS || "1500", 10);

async function pressureOk(c: Client): Promise<boolean> {
  const t0 = Date.now();
  try { await c.query("select 1"); return Date.now() - t0 <= PRESSURE_SLOW_MS; } catch { return false; }
}

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const storeId = Number(arg("store"));
  if (!Number.isFinite(storeId)) { console.error("usage: backfill-gap-scan --store <id> [--batch N] [--pace-ms N] [--from-id N] [--dry-run]"); process.exit(1); }
  const dry = has("dry-run");
  const confirmWrite = has("confirm-write");
  // Explicit-intent safety gate: a flag-parsing mistake here (this exact one happened while
  // building this script — `has()` originally didn't match the `--` prefix, so `--dry-run`
  // silently never engaged) must never fall through to "run for real" by default. Require
  // an explicit `--confirm-write` to actually write; `--dry-run` always wins if both are given.
  if (!dry && !confirmWrite) {
    console.error("refusing to run: pass --dry-run to preview, or --confirm-write to actually write staging rows.");
    process.exit(1);
  }
  console.log(dry ? "MODE: DRY RUN — nothing will be written" : "MODE: LIVE WRITE — staging rows will be upserted");
  const batch = Math.min(5000, parseInt(arg("batch") ?? "2000", 10));
  const paceMs = Math.max(300, parseInt(arg("pace-ms") ?? "1000", 10));
  let fromId = Math.max(0, parseInt(arg("from-id") ?? "0", 10));

  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL || ""), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("SET statement_timeout = '25s'");

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const defs = Object.values(CATEGORY_DEFS);

  const { rows: curRows } = await pg.query<{ last_raw_id: string }>(
    `select last_raw_id from tps_progress_cursors where store_id = $1 and category = '_all_'`, [storeId],
  );
  const cursor = curRows.length ? Number(curRows[0].last_raw_id) : 0;
  console.log(`── backfill-gap-scan store=${storeId} cursor=${cursor} from-id=${fromId} batch=${batch}${dry ? " DRY" : ""} ──`);

  let totalScanned = 0, totalGaps = 0, totalStaged = 0;
  for (;;) {
    if (!(await pressureOk(pg))) { console.log("  [governor] pressure red — sleeping 30s"); await new Promise((r) => setTimeout(r, 30_000)); continue; }

    const { rows } = await pg.query<{
      id: string; store_id: number; raw_name: string | null; payload: Record<string, unknown> | null; scraped_at: string | null;
    }>(
      `select id, store_id, raw_name, payload, scraped_at from raw_observations
        where store_id = $1 and id > $2 and id <= $3
        order by id asc limit $4`,
      [storeId, fromId, cursor, batch],
    );
    if (!rows.length) break;
    totalScanned += rows.length;

    const ids = rows.map((r) => Number(r.id));
    const { rows: stagedRows } = await pg.query<{ raw_obs_id: number }>(
      `select distinct raw_obs_id from tps_identity_staging where raw_obs_id = any($1::bigint[])`, [ids],
    );
    // node-postgres returns `bigint` columns as strings (to avoid silent precision loss) —
    // `raw_obs_id` here is a string ('150518'), not a number. Normalizing both sides to
    // Number before building/querying the Set matters: a naive string/number mismatch here
    // would make EVERY lookup fail and report every row as an unstaged gap (caught live: an
    // early un-normalized version of this exact check reported all 4,197 rows as gaps when
    // ~79% were already correctly staged).
    const stagedSet = new Set(stagedRows.map((r) => Number(r.raw_obs_id)));
    const gapRows = rows.filter((r) => !stagedSet.has(Number(r.id)));
    totalGaps += gapRows.length;

    const stagingRows: Record<string, unknown>[] = [];
    for (const row of gapRows) {
      const p = row.payload ?? {};
      const { nameAr, nameEn, brand, url } = adaptRow(p, row.raw_name);
      for (const def of defs) {
        if (!def.plugin.detect(nameAr, nameEn)) continue;
        const norm = def.normalize(nameAr, nameEn, brand, p);
        const identity = def.plugin.buildIdentityKey(brand, norm.payload, { model_number: norm.model_number });
        if (identity.status === "invalid" || !identity.key) continue;
        const conf = def.plugin.scoreConfidence(brand, norm.payload, norm.model_number, norm.ambiguity_flags);
        const rawImg = extractImage(p);
        stagingRows.push({
          category: def.category, raw_obs_id: Number(row.id), store_id: row.store_id, identity_key: identity.key,
          status: identity.status, price: extractPrice(p), url, name: (nameEn || nameAr).slice(0, 300),
          confidence: conf.confidence, detected: true,
          payload: { ...norm.payload, ...(rawImg ? { _image: rawImg } : {}), ...(isValidGtin(p.gtin as string) ? { _gtin: String(p.gtin).replace(/\D+/g, "") } : {}) },
          observed_at: row.scraped_at ?? new Date().toISOString(),
        });
      }
    }

    if (!dry && stagingRows.length) {
      for (let i = 0; i < stagingRows.length; i += 500) {
        const { error } = await sb.from("tps_identity_staging").upsert(stagingRows.slice(i, i + 500), { onConflict: "category,raw_obs_id" });
        if (error) throw new Error(`staging upsert: ${error.message}`);
      }
    }
    totalStaged += stagingRows.length;

    fromId = Number(rows[rows.length - 1].id);
    console.log(`  ...through id ${fromId} — scanned ${rows.length}, gaps found ${gapRows.length}, staging rows ${dry ? "would be " : ""}written ${stagingRows.length}`);
    if (has("debug-samples") && gapRows.length) {
      console.log("  sample gap titles (first 15):");
      for (const r of gapRows.slice(0, 15)) {
        const p = r.payload ?? {};
        const { nameAr, nameEn } = adaptRow(p, r.raw_name);
        const hits = defs.filter((d) => d.plugin.detect(nameAr, nameEn)).map((d) => d.category);
        console.log(`    id=${r.id} nameAr="${nameAr.slice(0, 60)}" nameEn="${nameEn.slice(0, 60)}" detects=[${hits.join(",")}]`);
      }
    }
    await new Promise((r) => setTimeout(r, paceMs));
  }

  console.log(`\n── done: scanned=${totalScanned} gaps_found=${totalGaps} staging_rows_${dry ? "would_be_" : ""}written=${totalStaged} ──`);
  console.log(`   NOTE: gaps_found counts raw_observations rows with no staging row at all — this includes rows`);
  console.log(`   genuinely undetected by every plugin (correct, not a defect) as well as real recovered gaps.`);
  console.log(`   The cursor (${cursor}) was NOT modified by this script.`);
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
