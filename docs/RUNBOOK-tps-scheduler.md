# Runbook — TPS Scheduler (E6)

Authenticated, category-isolated, hard-bounded, overlap-safe entry point for running one bounded TPS batch. See ADR-025. **Never processes the backlog** — one category, one ≤500 batch per request.

## Endpoint
`POST /api/cron/tps-batch` (Node.js runtime). `GET` is read-only health only.

**Auth:** `Authorization: Bearer <CRON_SECRET>` — anonymous/other requests → 401.

**Body:**
```json
{ "category": "mobile" | "air_conditioner", "limit": 1..500, "dryRun": true }
```
- `category` — required; `"all"` and any other value → 400. One category per request.
- `limit` — required integer; `>500` or `<1` → 400. Total observation cap (split across the category's stores).
- `dryRun` — defaults **true**; a write requires explicit `"dryRun": false`.

**Responses:** `200` (success summary), `409` `{overlapRejected:true}` (a same-category run is active), `400` (validation), `401` (auth), `500` (lock/exec error). The summary is sanitized (counts, category, build SHA) — never secrets.

## Invocation (never echo the secret)
```bash
# dry-run (safe)
node -e "require('dotenv').config({path:'.env.local'});fetch('https://tawveeri.com/api/cron/tps-batch',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.CRON_SECRET},body:JSON.stringify({category:'air_conditioner',limit:500,dryRun:true})}).then(r=>r.json()).then(console.log)"
# write (idempotent repeat safe): set dryRun:false
```
pg_cron / PM2 dispatcher can POST this on a schedule with the Bearer header. Keep each scheduled job to ONE category and `limit ≤ 500`. Do not chain batches.

## Safety mechanisms
- **Auth:** `Bearer CRON_SECRET`, reused from the E4 cron pattern.
- **Hard bound:** route rejects `limit>500`; the matcher asserts `fetched ≤ limit` and throws otherwise.
- **Category isolation:** `runMobileBatch` only writes `mobile`, `runAcBatch` only `air_conditioner`; each throws if handed the wrong category (before any DB access).
- **Fingerprint:** the batch refuses to write unless the live project ref is `vyceqrzttspyycdpojtn`.
- **Overlap (atomic):** `tps_acquire_run(category)` (`009_tps_scheduler_locks.sql`) uses `pg_advisory_xact_lock` to serialize per category and inserts a `running` `scraping_runs` row as the persistent lock. A concurrent same-category request → `null` → 409. Stale `running` rows (>30 min) are treated as dead so a crash can't freeze a category.
- **Run log:** every run is a `scraping_runs` row (`store_name='tps:<category>'`); `tps_finish_run` records status + sanitized metadata (category, limit, fetched, proposed, written, normalized, matches, prices, statusUpdates, duration, success, error, buildSha).
- **Retry safety:** a failed write throws **before** the status update → observations stay `pending`; a retry re-attempts and is idempotent (deterministic IDs upsert; unchanged prices append nothing).

## Overlap / lock lifecycle
acquire (running row) → run batch → `tps_finish_run` (status=success|failed, sets finished_at/duration). On crash: the row stays `running` until the 30-min stale window, then a new run may acquire.

## Verification (production)
- Unauthenticated POST → 401. Invalid `category`/`limit` → 400. `GET` → read-only health.
- Two concurrent same-category POSTs → one 200, one 409 (overlap).
- One bounded run (prefer AC idempotent repeat): counts reconcile, lock acquired+released, `fetched ≤ limit`, only the requested category touched, no duplicate unchanged-price rows, statuses reconcile, projection valid, live mobile/AC search healthy.
