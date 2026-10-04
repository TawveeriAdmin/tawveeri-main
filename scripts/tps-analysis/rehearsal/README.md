# TPS rehearsal replica (local, disposable)

A local PostgreSQL 17.6 + PostgREST 13.0.8 replica of the Tawveeri production TPS tables, built from the
**production catalog** (read-only) and a bounded data sample, so the REAL pipeline code
(`scripts/tps-core/progressive-engine.ts` `runSweepUnit`, which talks to Supabase through `sb.from()` /
`sb.rpc("write_ac_batch")`) can be run, snapshotted and rolled back without touching production.

Production is READ-ONLY here: `lib.ts` `prodClient()` opens a session with `default_transaction_read_only=on`
and a JS guard that refuses any non-read statement. Nothing in this directory writes to production.
Nothing outside `scripts/tps-analysis/rehearsal/` is modified (its own `package.json` + `node_modules`,
so the repo `package.json`/lockfile are untouched; `.gitignore` excludes `.data`, `node_modules`, `bin`).

## Ports

| What | Address |
|---|---|
| Postgres 17.6 (db `tps`, superuser `postgres`, trust auth, localhost only) | `127.0.0.1:54329` |
| PostgREST 13.0.8 (`db-max-rows=1000`) | `127.0.0.1:54330` |
| Proxy for supabase-js (strips `/rest/v1`) = the **local Supabase URL** | `http://127.0.0.1:54331` |

The local `service_role` JWT is minted from a random secret in `.data/secrets.json` (`lib.ts serviceKey()`).

## Commands (run from the repo root)

```bash
# one-time: install the Postgres binaries into the rehearsal dir (does not touch the repo package.json)
(cd scripts/tps-analysis/rehearsal && npm install --no-audit --no-fund --no-package-lock)

npx tsx scripts/tps-analysis/rehearsal/start.ts     # idempotent: Postgres + PostgREST + proxy, waits until healthy
npx tsx scripts/tps-analysis/rehearsal/setup.ts     # schema from prod catalog + data sample + cursors + parity.md (~7 min)
npx tsx scripts/tps-analysis/rehearsal/setup.ts --plan-only   # just print what would be copied (cheap prod index reads)
npx tsx scripts/tps-analysis/rehearsal/db-snapshot.ts save baseline      # instant clone of the whole DB
npx tsx scripts/tps-analysis/rehearsal/snapshot.ts --out before.json     # row counts + content hashes
npx tsx scripts/tps-analysis/rehearsal/run-sweep.ts --limit 500 --stores 4,5          # REAL runSweepUnit, flag unset (v1)
TPS_IDENTITY_V2=1 npx tsx scripts/tps-analysis/rehearsal/run-sweep.ts --limit 500 --stores 4,5
npx tsx scripts/tps-analysis/rehearsal/snapshot.ts --out after.json
npx tsx scripts/tps-analysis/rehearsal/snapshot.ts --diff before.json after.json
npx tsx scripts/tps-analysis/rehearsal/db-snapshot.ts restore baseline   # back to the pre-sweep state in seconds
npx tsx scripts/tps-analysis/rehearsal/verify-truncation.ts              # proves db-max-rows=1000 silent truncation
npx tsx scripts/tps-analysis/rehearsal/parity.ts                         # re-compare local catalog vs production, rewrite parity.md
npx tsx scripts/tps-analysis/rehearsal/stop.ts                           # stop ONLY what start.ts started
```

PowerShell: identical, with `$env:TPS_IDENTITY_V2='1'; npx tsx ...` for the flag.

### run-sweep.ts flags
`--limit N` (<=500, engine cap) - `--stores 4,5` - `--dry` - `--rewind` (reset the `_all_` cursors of the selected stores to the
post-setup baseline in `.data/cursor-baseline.json`, so the SAME raw rows are replayed) - `--repeat K` - `--json FILE`.
Safety: loopback URL only; hard-fails if any env var in the shell points at `*.supabase.co`; does not load `.env.local`.
The engine's import chain calls dotenv on `.env.local` at import time, so after the imports `run-sweep.ts` **scrubs**
every `SUPABASE*` / `supabase.co` variable from `process.env` (it prints which) — nothing in that process can reach production.

### snapshot.ts
Per table: row count, `full_hash` (every column) and `content_hash` (volatile bookkeeping removed: identity ids,
`matched_at`, `data_updated_at`, `updated_at`). Same `content_hash` + different `full_hash` = same facts, only write-time
stamps moved.

## What is loaded (defaults; env `REH_CATEGORIES`, `REH_RAW_DAYS`, `REH_RAW_CAP`)

* ALL rows: `stores`, `canonical_products`, `tps_current_offers`, `tps_progress_cursors`, `tps_product_projection`,
  `tps_price_implausibility_signals`, `tps_offer_delist_signals`, `samsung_official_url_baseline` (the engine reads it).
* `normalized_product_observations`, `product_matches`, `price_history`: only for canonicals of categories `mobile`, `tv`.
* `raw_observations`: last 3 days (by the store's own newest `scraped_at`) per TPS store, capped at 60,000/store.
* `tps_identity_staging`: EMPTY (hot path never reads it; the sweep writes to it).
* Cursors: for each store with copied raw rows, `tps_progress_cursors(_all_)` = (min copied raw id) - 1.

Reads from production are keyset-paginated (PK order) or canonical-id-chunked index lookups; no bare `.limit()`,
no table scans of `raw_observations` / `normalized_product_observations`.

## Measured (this machine, 2026-10-04)

| Item | Value |
|---|---|
| `start.ts` first run (initdb + 3 processes) | ~22 s; later ~3 s |
| `setup.ts` full (plan ~55 s, schema 5 s, load ~350 s, indexes/FKs 11 s) | ~7 min (414 s) |
| Rows loaded | canonical_products 21,225 - normalized_product_observations 164,282 - product_matches 1,862 - price_history 41,925 - raw_observations 106,385 - tps_current_offers 10,968 - projection 9,405 |
| Local DB size | 389 MiB (`.data/pgdata` incl. WAL a bit more); `node_modules` 101 MB; PostgREST binary 68 MB |
| One `run-sweep.ts --limit 500 --stores 4,5` | ~10 s (14 s wall incl. TS startup) |
| `snapshot.ts` | ~2 s |

See `parity.md` for the generated parity report (catalog comparison + every deliberate omission).

## Known limits
See the "Deliberate omissions and deviations" section of `parity.md`. Highlights: no RLS policies/extensions/cron/pgmq;
`C` collation; fsync off; `tps_identity_staging` starts empty; history tables are sampled to `mobile`/`tv`;
non-write-path RPCs (`write_mobile_batch`, `smart_search`, ...) are not copied; `scraping_runs`,
`identity_resolution_events` and other tables outside the engine's write path do not exist locally.
