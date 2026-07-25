-- 22-usage-events.sql — Real-customer measurement layer (Founder Directive Part 6).
-- Additive + idempotent. Separates real customer behaviour from test traffic so we NEVER
-- claim user validation until real users exist. Append-only; anonymous session ids only
-- (no PII, no user link). RLS enabled with NO anon/authenticated policies → server-only
-- (service role) writes via POST /api/events; nothing is readable by the public.

create table if not exists usage_events (
  id           bigint generated always as identity primary key,
  event_type   text not null,          -- advisor_query | advisor_result | evidence_view | go_click | no_answer | error | product_view
  session_id   text,                   -- anonymous client session (uuid in localStorage), NOT a user id
  is_test      boolean not null default false,
  category     text,
  query_text   text,                   -- truncated shopper query (≤200 chars; no PII expected)
  canonical_id text,
  store        text,
  source       text,                   -- channel: web | agent | mobile | api
  meta         jsonb,                  -- small structured extras (count, supported, verdict…)
  user_agent   text,
  created_at   timestamptz not null default now()
);

alter table usage_events enable row level security;
-- (No policies created on purpose: only the service role — the server — may read/write.)

create index if not exists usage_events_created_idx on usage_events (created_at desc);
create index if not exists usage_events_type_test_idx on usage_events (event_type, is_test);
create index if not exists usage_events_category_idx  on usage_events (category);

-- Mark the monetization record (outbound_clicks) as real vs test too, so measured-exit
-- economics can exclude test traffic honestly.
alter table outbound_clicks add column if not exists is_test boolean not null default false;
