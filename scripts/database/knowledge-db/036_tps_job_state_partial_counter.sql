-- 036 — tps_job_state: make a partial cycle visible (2026-10-03)
--
-- WHY: `last_success_at` only advances on a clean `success` outcome (028, and
-- jobDue relies on that). Since 2026-09-29 amazon/extra/samsung price_update
-- end `partial` on every cycle — by design, the 480s per-store ceiling
-- (ADR-394) — so last_success_at froze at 2026-09-29 while the job kept
-- writing ~60 rows per cycle. Read alone, that looks like a stall.
--
-- These two columns sit BESIDE last_success_at. They do not change what
-- `success` means, and jobDue keeps reading last_success_at only.
--   last_partial_at  — stamped when the outcome is `partial`.
--   rows_written     — sum(products_updated) over the job's own scraping_runs
--                      rows since the job started (price_update / discovery);
--                      null for jobs without a scraping_runs ledger.
--
-- The worker also applies this idempotently at runtime (job-state.ts jobDone),
-- the same way 028's create-table is applied — this file is the schema record.

alter table tps_job_state
  add column if not exists last_partial_at timestamptz,
  add column if not exists rows_written integer;

comment on column tps_job_state.last_partial_at is
  'Last time the job ended partial (did work, hit its own budget). last_success_at is untouched by a partial run.';
comment on column tps_job_state.rows_written is
  'products_updated summed over the job''s scraping_runs rows for its last run; null when the job has no scraping_runs ledger.';
