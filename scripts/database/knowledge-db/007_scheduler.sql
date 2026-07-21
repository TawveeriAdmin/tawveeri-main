-- 007_scheduler.sql
-- Knowledge database (vyceqrzttspyycdpojtn) — E4 Scheduler-as-Code
--
-- PURPOSE
--   Bring the production scheduler under version control. Before E4 the only
--   authoritative scheduler — Supabase pg_cron — was defined solely in the
--   Supabase dashboard: invisible to code review, absent from the repository,
--   and lost on any database restore. This file is the canonical definition of
--   the ingestion schedule. The live pg_cron jobs must be reconciled to it.
--
-- AUTHORITATIVE SCHEDULER
--   Supabase pg_cron is the single authoritative scheduling mechanism. It
--   invokes the authenticated cron routes via pg_net with the Bearer secret.
--   No other mechanism may schedule production ingestion. (The GitHub Actions
--   Jarir trigger is retired by this file — see step 3 and the transition plan.)
--
-- SECURITY
--   Every scheduled call is a POST carrying Authorization: Bearer <CRON_SECRET>.
--   The secret is read from Supabase Vault, never inlined. GET can no longer
--   trigger any write (fixed in the application routes in the same E4 change).
--
-- PREREQUISITES
--   - CRON_SECRET stored in Vault as 'cron_secret'.
--   - App base URL known (https://tawveeri.com).
--   - pg_cron and pg_net extensions enabled (they are on this project).
--
-- APPLY: run in the Supabase SQL editor for project vyceqrzttspyycdpojtn only,
--   after confirming project identity (to_regclass fingerprint). Read-only until
--   run; re-runnable (unschedule-then-schedule by job name).

-- ─────────────────────────────────────────────────────────────
-- Helper: resolve the app base URL + secret once.
-- ─────────────────────────────────────────────────────────────
-- SELECT vault.create_secret('<CRON_SECRET value>', 'cron_secret');  -- one-time, if absent

-- ─────────────────────────────────────────────────────────────
-- 1. Adapter discovery (Almanea, Extra) — every 6 hours, offset :00.
--    Route: POST /api/cron/discover-firecrawl  (loops enabled adapters)
-- ─────────────────────────────────────────────────────────────
SELECT cron.unschedule('tawveeri_discover_firecrawl')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tawveeri_discover_firecrawl');

SELECT cron.schedule(
  'tawveeri_discover_firecrawl',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://tawveeri.com/api/cron/discover-firecrawl',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ─────────────────────────────────────────────────────────────
-- 2. Jarir discovery — every 6 hours, offset :30 (staggered from adapters).
--    Route: POST /api/cron/discover-products {store_slug: jarir}
--    This MOVES Jarir onto pg_cron so the GitHub Actions trigger can retire.
-- ─────────────────────────────────────────────────────────────
SELECT cron.unschedule('tawveeri_discover_jarir')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tawveeri_discover_jarir');

SELECT cron.schedule(
  'tawveeri_discover_jarir',
  '30 */6 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://tawveeri.com/api/cron/discover-products',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body    := '{"store_slug":"jarir","max_pages":3}'::jsonb
  );
  $$
);

-- ─────────────────────────────────────────────────────────────
-- 3. After confirming job 2 fires successfully (a jarir scraping_runs row
--    appears on the :30 cadence), retire the GitHub Actions trigger:
--    delete .github/workflows/tps-heartbeat.yml in the repository.
--    DO NOT delete it before this job is verified live, or Jarir ingestion
--    stops. Overlap protection tolerates a transient double-trigger safely.
-- ─────────────────────────────────────────────────────────────

-- Verify:
-- SELECT jobid, jobname, schedule, active FROM cron.job
--   WHERE jobname LIKE 'tawveeri_%' ORDER BY jobname;
