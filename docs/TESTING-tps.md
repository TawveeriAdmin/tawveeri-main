# TPS / E6 Automated Test Documentation

## Inventory
| Suite | Covers |
|---|---|
| `tests/scraping/tps-scheduler.test.ts` (21) | hard bound (≤500, reject >500/<1), fingerprint match/mismatch, per-store split, **category isolation** (behavioral — throws before DB), route-wiring drift guards (auth, no `all`, 409 overlap, dryRun default, POST/GET, sanitized metadata) |
| `tests/scraping/ac-pipeline.test.ts` (9) | AC brand canonicalization (ADR-022), identity contract (valid/fallback/invalid), cross-store corroboration (AR==EN key), no-merge of incompatible fields, deterministic `stableUuid`, category isolation |
| `tests/scraping/search-category-routing.test.ts` (9) | mobile/AC/accessory/unknown query routing, one-category-per-query, UI bridge, route-wiring drift guards |
| `tests/scraping/smart-pick.test.ts` (6) | accessory/compatibility detection, decision-card trust gate (mobile Smart Pick) |
| `tests/scraping/store-identity-propagation.test.ts`, `scheduler-security.test.ts`, `product-filter.test.ts`, `tests/database/rls-coverage.test.ts`, `tests/utils.test.ts` | prior E1–E5 invariants (pass) |

## Commands
```bash
npm test                                  # full suite
npx jest tests/scraping/tps-scheduler.test.ts        # scheduler invariants
npx jest tests/scraping/ac-pipeline.test.ts          # AC identity/brand
npx jest tests/scraping/search-category-routing.test.ts  # search routing
# targeted E6 set:
npx jest tests/scraping/{tps-scheduler,ac-pipeline,smart-pick,search-category-routing}.test.ts
```

## Expected results
- **Targeted E6 suites: all pass** (scheduler 21, AC 9, routing 9, smart-pick 6, store-identity, scheduler-security, product-filter, rls, utils).
- **Full suite: 110 passed, 28 failed.**

## Environment-dependent failures (the 28)
All 28 failures are **environment/DB-integration** — suites that require a live Supabase/test database not available in the local jest environment:
- `tests/database/connection.test.ts`, `tests/database/queries.test.ts` — `from('users')`/`from('stores')` live queries.
- `tests/auth/profile.test.ts`, `tests/auth/audit.test.ts`, `tests/auth/notifications.test.ts` — `getUserProfile`/`createAuditLog`/`createNotification` against a DB.

These predate all E6 TPS/search/scheduler work and are **unrelated** to it. Classification is by suite+test name+failure signature; E6 rounds introduced **0 new failures**. Do not label a failure "pre-existing" without comparing these signatures.

## Production verification procedure (scheduler)
1. Unauthenticated `POST /api/cron/tps-batch` → 401.
2. Invalid `category` (`tv`,`all`) / invalid `limit` (`501`,`0`) → 400.
3. `GET /api/cron/tps-batch` → read-only health JSON.
4. One authenticated dry-run per category → success summary, `fetched ≤ limit`.
5. One authenticated write run (AC idempotent) → counts reconcile, run-log row, lock released.

## Rollback-test procedure (`write_ac_batch` / `write_mobile_batch`)
Call the RPC with a valid canonical but a non-numeric `price` (throws mid-transaction); assert the canonical row does **not** persist (atomic rollback, 0 residue). See ADR-023.

## Overlap-test procedure
`SELECT tps_acquire_run('mobile')` → id; a second call while the first is unfinished → `NULL`; `tps_finish_run(id,'success')` → a third call returns a new id. Over HTTP: two concurrent same-category POSTs → one 200, one 409.

## Retry-test procedure
Force a write failure (fingerprint mismatch or bad payload); assert the batch returns `success:false`, the run-log row is `failed`, affected observations remain `pending`, and a subsequent valid run is idempotent (no duplicate canonicals; unchanged prices append no rows).
