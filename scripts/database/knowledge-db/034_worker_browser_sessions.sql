-- 034 — Worker browser-session accounting (2026-09-19, Browserless cost incident).
--
-- WHY THIS EXISTS. A "100% of plan units consumed" alert arrived from Browserless
-- with no way to attribute consumption by store, job, or time from our side —
-- Browserless exposes no accessible usage API without dashboard login, and
-- Railway's own log retention doesn't reach back far enough to reconstruct
-- yesterday's activity precisely. This table is OUR OWN durable, queryable
-- record of every browser session base-scraper.ts opens, going forward —
-- whether it actually connected to Browserless or fell back to a local
-- Chromium launch — so this question is answerable directly next time, and so
-- a per-store/per-job cost-per-useful-result figure can be computed instead of
-- guessed at.
create table if not exists worker_browser_sessions (
  id             bigint generated always as identity primary key,
  store_slug     text        not null,
  -- 'price_update' | 'discovery' | 'unknown' (set via WORKER_CURRENT_JOB_TYPE,
  -- passed by the spawning job file — see base-scraper.ts's own comment).
  job_type       text        not null default 'unknown',
  -- 'browserless' | 'local' — which branch of launchBrowser() actually served
  -- this session. A session that failed BEFORE either branch succeeded (e.g.
  -- both Browserless and the local launch itself failed) is NOT counted here;
  -- that failure is already visible in scraping_runs.error_summary.
  connected_via  text        not null check (connected_via in ('browserless','local')),
  -- Set only when connected_via='browserless' and the failure that preceded a
  -- (possible) local fallback looked like a quota/rate-limit signal (429, or
  -- the response/error text contains 'quota'/'limit'/'unit'). This is the
  -- signal the circuit-breaker in base-scraper.ts uses to decide "defer this
  -- store" vs "this was just a network blip."
  quota_signal   boolean     not null default false,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  duration_ms    integer,
  -- 'closed_ok' | 'error' | 'still_open' (a session whose ended_at update
  -- never landed — e.g. the process was SIGKILLed — is left 'still_open' and
  -- is NOT reaped automatically; unlike scraping_runs, a stale row here has no
  -- safety implication, it is purely a metrics record, so there is no boot-time
  -- reaper for this table and none is needed).
  outcome        text        not null default 'still_open',
  error_message  text,
  created_at     timestamptz not null default now()
);

create index if not exists worker_browser_sessions_store_started_idx
  on worker_browser_sessions (store_slug, started_at desc);
create index if not exists worker_browser_sessions_connected_via_idx
  on worker_browser_sessions (connected_via, started_at desc);

-- Constitution: every table enables RLS in its schema definition. Pipeline/
-- observability state, not customer data — service-role only, same posture as
-- samsung_delta_watch_runs (032_samsung_delta_watch.sql).
alter table worker_browser_sessions enable row level security;
