# E6 Handoff — TPS Pipeline Automation

For continuing E6 in a fresh Claude Code session. **Governance:** the seven-part Executive Engineering Prompt + all governance sent 2026-07-21 remain authoritative (bounded ≤500, dry-run-first, snapshot, reversible, precision-over-recall, production-verified, no secrets committed/printed, `.env.local` gitignored/untracked, never process the 131k backlog, never generalize the mobile matcher to another category, do not start E7). Read `docs/DECISIONS.md` ADR-011..021, `docs/ROADMAP.md`, `docs/TPS.md`, `docs/RUNBOOK-tps-bounded-batch.md`.

## DONE & production-verified
- **Mobile pipeline SHIPPED** (ADR-015..018): bounded matcher `scripts/tps-matcher/mobile-matcher-v2-dry.ts` (≤4×`MATCHER_LIMIT`, `DRY_RUN` default, atomic `write_mobile_batch`, deterministic/idempotent, rollback snapshots, marks committed obs `done`). Projection `build-tps-projection.ts`. mobile/smartphone two-plane resolved (canonical=`mobile`; ADR-017). Live Smart Pick healthy.
- **AC pipeline SHIPPED** (ADR-022/023 — supersedes the wrong ADR-021 store-coverage conclusion): the blocker was **brand normalization** (`إل جي`≠`LG`), fixed in `tps-core/brand-map.ts` (bilingual AC brands) + `ac/identity.ts` (canonicalizes brand). `write_ac_batch` created (`scripts/database/knowledge-db/008_write_ac_batch.sql`; atomic, service-role-only, rollback-verified). `scripts/tps-matcher/ac-matcher-v1-dry.ts` is write-capable (balanced Extra+Almanea ≤500, writes only ≥2-store-corroborated, marks obs `done`). First bounded batch wrote **7 AC canonicals** (LG/GREE/Westinghouse); projection 41→48; no regression. Tests `tests/scraping/ac-pipeline.test.ts` (9/9).
- **Support tables:** `parser_improvement_queue` + `identity_resolution_events` EXIST; `ac_identity_state` + `conflict_review` **do NOT exist** (earlier handoff was wrong).

## REMAINING E6 (next units)
1. **Surface AC in live search:** `searchTPSCanonical` (`src/app/api/search/route.ts:466`) is hardcoded `.eq('category','mobile')`; extend to include `air_conditioner` and fix the category bridge (`route.ts:509` sets `'smartphone'`). Then AC Smart Pick/compare goes live. Verify + deploy (Railway auto-deploy on push to main).
2. **Scheduler/overlap (Phase 7):** category-isolated, hard-bounded, advisory-lock overlap (reuse E1 `scraping_runs`), production-fingerprint check, safe retries (failed write never marks `done`), observable logs, no backlog. Matcher runs via `npx tsx` CLI today — wiring "scheduler-controlled" needs an API route or pg_cron→HTTP path. Demonstrate one bounded scheduled run.
3. **Broader tests:** integration tests for ≤500 bound, idempotency, projection integrity, mobile regression (pure-logic ones exist).

## Environment / connection notes
- `SUPABASE_DB_URL` present in `.env.local` (production `vyceqrzttspyycdpojtn`). **Direct endpoint is IPv6-only and intermittent**; the shared Supavisor pooler does NOT host this project (tenant-not-found) — so DDL must go over the direct connection with a **connect-retry** loop (see the pattern in session scripts). PostgREST/HTTPS (service-role via `@supabase/supabase-js`) is reliable for all data reads/writes and RPC calls.
- Support tables all exist: `identity_resolution_events`, `ac_identity_state`, `parser_improvement_queue`, `conflict_review`.
- `raw_observations.processing_status` check constraint: `pending|processing|done|failed|skipped` (NOT `processed`).
- `raw_observations.id` is bigint (number); canonical/normalized ids are uuid (deterministic `stableUuid`). `price_history` is append-only.

## NEXT UNITS (in order)
1. **Build `write_ac_batch`** as tested infrastructure (ADR-020 spec) — even though the current AC batch would write 0. DDL over the direct connection (connect-retry). Mirror `write_mobile_batch` (fetch its def via `pg_get_functiondef`), category-specific: upsert canonical/normalized by deterministic id; `delete product_matches where canonical_product_id = any(p_canonical_ids)` then insert; append changed `price_history`; append `identity_resolution_events`; upsert `ac_identity_state` by identity_key; insert `parser_improvement_queue`/`conflict_review`; single txn; atomic. After create: `pg_get_functiondef` read-only; verify signature/permissions (service-role/direct only, not anon/authenticated). Intentionally test transaction rollback on a throwaway id set.
2. **AC store-coverage / parser gap** (the real blocker to corroboration): either add a 2nd AC store whose catalog overlaps Extra's brands, or accept AC has no corroboration yet. Feed the 61 parser failures into `parser_improvement_queue` and improve `ac/parser.ts` (missing `technology`/`cooling_mode`). Do NOT write single-store fallbacks.
3. **Automated tests** (`tests/`): mobile bounded pipeline, projection, processing-status semantics, idempotency, rollback safety, category isolation, ≤500 hard bound, AC parser/identity, fallback-corroboration rejection of single-store. Jest.
4. **Scheduler/overlap** (only after tests pass): category-isolated, hard-bounded, advisory-lock overlap protection (reuse E1 `scraping_runs` run-logger), production fingerprint check, safe retries (failed write never marks `done`), observable logs, no backlog. Demonstrate one scheduler-controlled bounded mobile run. Wire via pg_cron/dispatch — see `docs/ARCHITECTURE.md` scheduler section.

## E6 completion criteria (do not declare complete before ALL)
mobile verified (✓) · AC pipeline verified end-to-end OR documented zero-corroboration with tested infra · projection includes eligible canonicals (✓ mobile) · statuses reconcile · automation bounded + overlap-safe + tested · rollback evidence · tests pass · no taxonomy/search regression · no secrets exposed · docs current · commits pushed.

## Rollback artifacts (this session, in scratchpad — re-snapshot before any new write)
`e6_batch_rollback.json` (mobile batch), `e6_projection_rollback.json`, `e6_ph2_rollback.json`/`e6_ph2c_rollback.json` (smartphone→mobile), `e6_ac_rollback.json`/`e6_appliance_rollback.json`/`e6_residual_rollback.json` (taxonomy). Scratchpad is session-scoped; re-derive snapshots in the new session before writing.
