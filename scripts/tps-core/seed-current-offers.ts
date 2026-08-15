// seed-current-offers.ts — ONE-TIME, EXPLICITLY-LAUNCHED, governor-paced seed of the
// HOT current-state table `tps_current_offers` from the COLD staging audit trail
// (ADR-252). This is the ONLY remaining reader of staging history, it runs only when a
// human launches it, and it is the replacement for the removed touch-triggered
// self-heal (which twice proved able to take down the consumer surface).
//
// Per category: one keyset pass over `DISTINCT ON (identity_key, store_id) … ORDER BY
// raw_obs_id DESC` equivalents, in bounded batches with pacing and a pressure probe
// between batches (gh-ost throttle doctrine: any red signal pauses).
//
// Usage:
//   npx tsx scripts/tps-core/seed-current-offers.ts --category tv [--batch 2000] [--pace-ms 1500] [--dry]
//   npx tsx scripts/tps-core/seed-current-offers.ts --all [--dry]
// Idempotent: pure upserts keyed (category, identity_key, store_id); a re-run converges.
// Resumable: batches are keyset-ordered by identity_key, and the last processed key is
// printed on every batch — pass --from-key <key> to resume after an interruption.
import { Client } from "pg";
import { toPoolerDbUrl } from "./pooler-url";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] ?? null : null;
};
const has = (name: string) => process.argv.includes(name);

const PRESSURE_SLOW_MS = parseInt(process.env.PRESSURE_PROBE_SLOW_MS || "1500", 10);

async function pressureOk(c: Client): Promise<boolean> {
  const t0 = Date.now();
  try {
    await c.query("select 1");
    return Date.now() - t0 <= PRESSURE_SLOW_MS;
  } catch {
    return false;
  }
}

(async () => {
  const category = arg("--category");
  const all = has("--all");
  const dry = has("--dry");
  const batch = Math.min(5000, parseInt(arg("--batch") ?? "2000", 10));
  const paceMs = Math.max(500, parseInt(arg("--pace-ms") ?? "1500", 10));
  let fromKey = arg("--from-key") ?? "";
  if (!category && !all) {
    console.error("usage: seed-current-offers --category <cat> | --all  [--batch N] [--pace-ms N] [--dry] [--from-key K]");
    process.exit(1);
  }
  const c = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL || ""), ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query("SET statement_timeout = '25s'");

  const cats = all
    ? (await c.query<{ category: string }>("select distinct category from tps_identity_staging order by 1")).rows.map((r) => r.category)
    : [category!];

  for (const cat of cats) {
    console.log(`── seeding ${cat} (batch ${batch}, pace ${paceMs}ms${dry ? ", DRY" : ""}) ──`);
    let seeded = 0;
    for (;;) {
      if (!(await pressureOk(c))) {
        console.log("  [governor] pressure red — sleeping 30s");
        await new Promise((r) => setTimeout(r, 30_000));
        continue;
      }
      // Keyset page of keys, then latest row per (key, store) for exactly those keys.
      const { rows: keys } = await c.query<{ identity_key: string }>(
        `select distinct identity_key from tps_identity_staging
          where category = $1 and identity_key > $2
          order by identity_key limit 50`, [cat, fromKey]);
      if (!keys.length) break;
      const keyList = keys.map((k) => k.identity_key);
      const sql = dry
        ? `select count(*) n from (
             select distinct on (identity_key, store_id) 1
               from tps_identity_staging
              where category = $1 and identity_key = any($2) and store_id is not null
              order by identity_key, store_id, raw_obs_id desc) x`
        : `insert into tps_current_offers
             (category, identity_key, store_id, raw_obs_id, status, price, url, name, confidence, payload, observed_at, updated_at)
           select category, identity_key, store_id, raw_obs_id, status, price, url, name, confidence,
                  coalesce(payload, '{}'::jsonb), observed_at, now()
             from (select distinct on (identity_key, store_id) *
                     from tps_identity_staging
                    where category = $1 and identity_key = any($2) and store_id is not null
                    order by identity_key, store_id, raw_obs_id desc) latest
           on conflict (category, identity_key, store_id) do update
             set raw_obs_id = excluded.raw_obs_id, status = excluded.status, price = excluded.price,
                 url = excluded.url, name = excluded.name, confidence = excluded.confidence,
                 payload = excluded.payload, observed_at = excluded.observed_at, updated_at = now()
           where tps_current_offers.raw_obs_id < excluded.raw_obs_id`;
      const res = await c.query(sql, [cat, keyList]);
      seeded += dry ? Number((res.rows[0] as { n: string }).n) : res.rowCount ?? 0;
      fromKey = keyList[keyList.length - 1];
      console.log(`  ...through ${fromKey.slice(0, 50)} (${seeded} rows${dry ? " would be" : ""} written)`);
      await new Promise((r) => setTimeout(r, paceMs));
      if (seeded >= batch * 50 && dry) break; // dry runs sample, they don't crawl everything
    }
    fromKey = "";
    console.log(`── ${cat}: ${seeded} current-offer rows ──`);
  }
  await c.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
