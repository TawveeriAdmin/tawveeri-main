-- 033_scraping_runs_pending_status.sql
--
-- WHY (2026-09-17, isolated-worker migration): src/lib/scraping/services/
-- run-logger.ts's ScrapingRunStatus type has declared 'pending' as a valid
-- value since before this migration existed, but scraper_runs_status_check
-- never actually allowed it — CHECK (status = ANY (ARRAY['running',
-- 'success', 'partial', 'failed'])). This was a latent code/schema mismatch
-- (discovered live, 2026-09-17, when a real insert with status='pending'
-- failed the constraint) rather than a new requirement: the admin "run now"
-- delegation (src/app/api/admin/scraping/schedules/[id]/run-now/route.ts)
-- needs a genuine "queued, not yet started by the isolated worker" state,
-- and 'running' would misrepresent a row nothing has started work on yet.
--
-- Minimal, additive fix: widen the existing constraint by exactly one value.
-- No new column, no new table, no other status values added (the worker's
-- proc-guard 'timeout'/'cancelled' outcomes are recorded in tps_job_state's
-- free-text last_note column, which has no such constraint, and are never
-- written to scraping_runs.status).
alter table scraping_runs drop constraint if exists scraper_runs_status_check;
alter table scraping_runs add constraint scraper_runs_status_check
  check (status = any (array['pending'::text, 'running'::text, 'success'::text, 'partial'::text, 'failed'::text]));
