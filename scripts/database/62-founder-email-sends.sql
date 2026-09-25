-- 62-founder-email-sends.sql — dated log of every daily founder email attempt.
-- Before this, a send left no trace in our own system (SendGrid's stats API is forbidden for the
-- restricted key, and the cron service's logs are per-deployment and rotate on every push), so
-- "did yesterday's email go out?" was unanswerable. One row per (report_date, kind); a row with
-- status 'sent' blocks any second send for the same day; failures are kept with their reason.
create table if not exists public.founder_email_sends (
  id            uuid primary key default gen_random_uuid(),
  report_date   date not null,                  -- the Riyadh calendar day the summary covers
  kind          text not null default 'daily' check (kind in ('daily','monthly','test')),
  recipient     text not null,
  subject       text not null,
  status        text not null check (status in ('sent','skipped_duplicate','failed','suppressed','not_configured','dry_run')),
  message_id    text,
  provider_status integer,
  error         text,
  summary_id    uuid,                            -- founder_summaries row the email rendered
  html_snapshot text,                            -- exact body sent (the "saved copy")
  trigger       text,                            -- cron | manual | test
  scheduled_for text,                            -- e.g. "08:00 Asia/Riyadh (0 5 * * * UTC)"
  attempted_at  timestamptz not null default now()
);
create unique index if not exists founder_email_sends_one_per_day_idx on public.founder_email_sends (report_date, kind) where status = 'sent';
create index if not exists founder_email_sends_date_idx on public.founder_email_sends (report_date desc, attempted_at desc);
alter table public.founder_email_sends enable row level security;
revoke all on public.founder_email_sends from public, anon, authenticated;
grant select, insert, update, delete on public.founder_email_sends to service_role;

-- ROLLBACK: drop table if exists public.founder_email_sends;
