# Runbook — TPS Bounded Mobile Batch (E6)

The repeatable, safe mechanism for growing the mobile canonical graph. **Never unleash the full backlog** — scale only through repeated verified bounded batches.

## Mechanism
`scripts/tps-matcher/mobile-matcher-v2-dry.ts` — reads `raw_observations` (4 mobile stores), normalizes → resolves identity → builds canonicals, and persists via the atomic `write_mobile_batch` RPC. Runs over HTTPS/PostgREST (no direct DB connection required).

## Safe execution
```bash
# 1) DRY RUN first (no writes). Proves candidate volume.
DRY_RUN=true  MATCHER_LIMIT=125 DUMP_IDS=/tmp/ids.json npx tsx scripts/tps-matcher/mobile-matcher-v2-dry.ts
# 2) Snapshot the batch's canonical/normalized IDs (rollback artifact) — see the snapshot script pattern in ADR-015.
# 3) WRITE (bounded). Only after reviewing the dry-run.
DRY_RUN=false MATCHER_LIMIT=125 npx tsx scripts/tps-matcher/mobile-matcher-v2-dry.ts
```

## Safety properties (each verified in production)
- **Hard batch limit:** all 4 store fetches respect `MATCHER_LIMIT` → **≤ 4 × limit observations** (limit=125 → ≤500). Cannot expand to the 131k backlog.
- **Category isolation:** mobile-only (keyword + 4 stores); writes `category='mobile'` only.
- **≥2-store corroboration:** groups with `<2` stores are skipped (precision over recall). Accessory and price-gap (>1.6×) outliers rejected.
- **Deterministic identity / idempotency:** canonical & normalized IDs are `stableUuid(key)`; re-running upserts the same rows (no proliferation).
- **Atomic persistence:** `write_mobile_batch` is a single plpgsql transaction (all-or-nothing).
- **Retry safety:** a failed write exits before the status update, leaving observations `pending`; re-running re-attempts and marks committed ones `done`.
- **Processing-status:** only the observations actually canonicalized are marked `done` (vocabulary: `pending|processing|done|failed|skipped`), after the atomic write succeeds.
- **Rollback:** pre-batch snapshot of the batch's deterministic IDs → new rows deletable, updated rows restorable, appended price rows removable.

## Before any run
- **Verify production fingerprint** (`vyceqrzttspyycdpojtn`): confirm `canonical_products`/`raw_observations` exist and counts are sane.
- Never print or commit `SUPABASE_DB_URL` or any secret. `.env.local` stays gitignored.

## Not yet wired (deliberately)
- **Scheduler/overlap protection:** no pg_cron/dispatch wiring — scaling is manual, one bounded batch at a time, by design. Overlap protection (the E1 `scraping_runs` run-logger) must be added before any scheduled automation.
- **Rebuild projection** after a batch: `npx tsx scripts/build-tps-projection.ts` (upsert-only; no deletes).

## Other categories
Only **mobile** is `READY_FOR_BOUNDED_PRODUCTION`. **air_conditioner** is `PARTIALLY_READY` (no `write_ac_batch` RPC / no bounded write-matcher). All others are `NOT_READY`. Do not generalize the mobile matcher to another category — build that category's own contract + write path first (see ADR-019).
