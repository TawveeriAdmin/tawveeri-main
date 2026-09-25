-- 58-founder-operating-center.sql — Founder Operating & Decision Center (2026-09-25 mandate).
-- ADDITIVE + IDEMPOTENT + REVERSIBLE (rollback block at the end). No existing row is changed.
--
-- Two halves:
--   A. READ functions — the ONE computation authority for the founder metrics register
--      (docs/FOUNDER-OPERATING-CENTER.md, S01..S08 / Q01..Q05 / D01..). They reproduce, in SQL,
--      the exact semantics independently verified in docs/evidence/founder-decisions-2026-09-25/
--      metric-queries.sql (91 / 80 / 4 / 204 / 116 / 12 on the frozen September window) so the
--      UI, the daily snapshot job and any auditor recompute the SAME number from the SAME code.
--      Half-open windows [p_start, p_end). `is_test=false` everywhere. A session_id is a
--      persistent browser identifier, never a person.
--   B. WRITE tables — founder ledgers (expenses, revenue/commissions, funding, budgets, goals,
--      settings, snapshots, summaries, audit). RLS enabled, NO anon/authenticated grants:
--      service-role (server) only, same convention as 22-usage-events.sql / 30-affiliate-*.sql.
--      Every ledger row is soft-deleted (deleted_at), versioned (revision) and audited
--      (founder_ledger_audit) — nothing is ever physically lost.

-- ─────────────────────────────────────────────────────────────────────────────
-- A. READ FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Numeric-safe reader for usage_events.meta->>'count' (a non-numeric value must never abort the
-- whole metric pack).
create or replace function public.founder_meta_num(p jsonb, k text)
returns numeric language sql immutable as $$
  select case when (p->>k) ~ '^[0-9]+(\.[0-9]+)?$' then (p->>k)::numeric else null end
$$;

-- The core window pack. One row of JSON, every key a named metric in the register.
create or replace function public.founder_window_metrics(p_start timestamptz, p_end timestamptz)
returns jsonb language sql stable as $$
with u as (
  select id, event_type, nullif(session_id,'') as session_id, query_text, created_at, meta, user_agent
  from usage_events
  where is_test = false and created_at >= p_start and created_at < p_end
), linked as (
  select o.interaction_id, nullif(o.session_id,'') as session_id, o.clicked_at, i.created_at as interaction_at
  from outbound_clicks o join first_party_interactions i using (interaction_id)
  where o.is_test = false and i.is_test = false
    and o.clicked_at >= p_start and o.clicked_at < p_end
    and i.created_at >= p_start and i.created_at < p_end
), search as (
  select * from u where event_type in ('search','advisor_query') and session_id is not null
), visits as (
  select session_id, created_at,
    case when lag(created_at) over (partition by session_id order by created_at, id) is null
           or created_at - lag(created_at) over (partition by session_id order by created_at, id) > interval '30 minutes'
         then 1 else 0 end as starts
  from u where session_id is not null
), first_seen as (
  select nullif(e.session_id,'') as session_id, min(e.created_at) as first_at
  from usage_events e
  where e.is_test = false and nullif(e.session_id,'') is not null
    and nullif(e.session_id,'') in (select distinct session_id from u where session_id is not null)
  group by 1
), first_event as (
  select distinct on (session_id) session_id, event_type, coalesce(meta->>'utm_source','unknown') as channel
  from u where session_id is not null order by session_id, created_at, id
)
select jsonb_build_object(
  'window_start', p_start, 'window_end', p_end,
  'observed_browsers', (select count(distinct session_id) from u),
  'visits_30m', (select coalesce(sum(starts),0) from visits),
  'new_browsers', (select count(*) from first_seen where first_at >= p_start),
  'returning_browsers', (select count(*) from first_seen where first_at < p_start),
  'intent_browsers', (select count(distinct session_id) from u
      where event_type in ('search','advisor_query','product_view','comparison_view','go_click','category_go_click','evidence_view','recommendation_accept')),
  'search_sessions', (select count(distinct session_id) from search),
  'search_events', (select count(*) from search),
  'positive_result_sessions', (select count(distinct s.session_id) from search s where exists (
      select 1 from u r where r.session_id = s.session_id and r.query_text = s.query_text
        and r.event_type in ('results','advisor_result') and coalesce(founder_meta_num(r.meta,'count'),0) > 0
        and r.created_at >= s.created_at and r.created_at <= s.created_at + interval '30 minutes')),
  'comparison_click_sessions', (select count(distinct session_id) from u where event_type='alternative_view' and meta->>'via'='compare_link'),
  'comparison_click_events', (select count(*) from u where event_type='alternative_view' and meta->>'via'='compare_link'),
  'comparison_auto_events', (select count(*) from u where event_type='comparison_view'),
  'product_after_search_sessions', (select count(distinct s.session_id) from search s where exists (
      select 1 from u r where r.session_id = s.session_id and r.event_type='product_view'
        and r.created_at >= s.created_at and r.created_at <= s.created_at + interval '30 minutes')),
  'product_view_events', (select count(*) from u where event_type='product_view'),
  'product_view_sessions', (select count(distinct session_id) from u where event_type='product_view'),
  'go_click_events', (select count(*) from u where event_type in ('go_click','category_go_click')),
  'go_click_sessions', (select count(distinct session_id) from u where event_type in ('go_click','category_go_click')),
  'explicit_interactions', (select count(*) from first_party_interactions where is_test=false and created_at >= p_start and created_at < p_end),
  'linked_interactions', (select count(distinct interaction_id) from linked),
  'linked_sessions', (select count(distinct session_id) from linked),
  'linked_after_search_sessions', (select count(distinct s.session_id) from search s where exists (
      select 1 from linked l where l.session_id = s.session_id and l.clicked_at >= s.created_at
        and l.clicked_at <= s.created_at + interval '30 minutes')),
  'raw_outbound_rows', (select count(*) from outbound_clicks where is_test=false and clicked_at >= p_start and clicked_at < p_end),
  'raw_outbound_without_session', (select count(*) from outbound_clicks where is_test=false and clicked_at >= p_start and clicked_at < p_end and nullif(session_id,'') is null),
  'raw_outbound_products', (select count(distinct canonical_product_id) from outbound_clicks where is_test=false and clicked_at >= p_start and clicked_at < p_end),
  'test_browsers', (select count(distinct nullif(session_id,'')) from usage_events where is_test=true and created_at >= p_start and created_at < p_end and coalesce(meta->>'excluded_reason','') <> 'admin_session'),
  'admin_browsers', (select count(distinct nullif(session_id,'')) from usage_events where is_test=true and created_at >= p_start and created_at < p_end and meta->>'excluded_reason' = 'admin_session'),
  'bot_ua_events_excluded', (select count(*) from usage_events where created_at >= p_start and created_at < p_end and user_agent ~* 'bot|crawl|spider|slurp|headless|puppeteer|playwright|python-requests|curl|wget'),
  'no_answer_events', (select count(*) from u where event_type='no_answer'),
  'error_events', (select count(*) from u where event_type='error'),
  'last_usage_event_at', (select max(created_at) from u),
  'last_outbound_at', (select max(clicked_at) from outbound_clicks where is_test=false and clicked_at >= p_start and clicked_at < p_end),
  'last_interaction_at', (select max(created_at) from first_party_interactions where is_test=false and created_at >= p_start and created_at < p_end),
  'channels', (select coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'browsers', n) order by n desc), '[]'::jsonb)
      from (select channel, count(*) n from first_event group by channel) c),
  'entry_types', (select coalesce(jsonb_agg(jsonb_build_object('event_type', event_type, 'browsers', n) order by n desc), '[]'::jsonb)
      from (select event_type, count(*) n from first_event group by event_type) c)
)
$$;

-- Per-query demand. session id arrays are INTERNAL (never rendered) — they let the caller union
-- sessions across queries of one need without double counting.
create or replace function public.founder_query_demand(p_start timestamptz, p_end timestamptz)
returns table (
  query_text text, search_events bigint, search_sessions bigint, top_session_events bigint,
  session_ids text[], positive_session_ids text[], product_session_ids text[], linked_session_ids text[],
  no_answer_events bigint, error_events bigint, first_seen timestamptz, last_seen timestamptz
) language sql stable as $$
with u as (
  select id, event_type, nullif(session_id,'') as session_id, query_text, created_at, meta
  from usage_events where is_test = false and created_at >= p_start and created_at < p_end
), linked as (
  select nullif(o.session_id,'') as session_id, o.clicked_at
  from outbound_clicks o join first_party_interactions i using (interaction_id)
  where o.is_test = false and i.is_test = false
    and o.clicked_at >= p_start and o.clicked_at < p_end and i.created_at >= p_start and i.created_at < p_end
), s as (
  select * from u where event_type in ('search','advisor_query') and session_id is not null and coalesce(query_text,'') <> ''
), per_search as (
  select s.query_text, s.session_id, s.created_at,
    exists (select 1 from u r where r.session_id=s.session_id and r.query_text=s.query_text and r.event_type in ('results','advisor_result')
            and coalesce(founder_meta_num(r.meta,'count'),0) > 0 and r.created_at >= s.created_at and r.created_at <= s.created_at + interval '30 minutes') as positive,
    exists (select 1 from u r where r.session_id=s.session_id and r.event_type='product_view'
            and r.created_at >= s.created_at and r.created_at <= s.created_at + interval '30 minutes') as product,
    exists (select 1 from linked l where l.session_id=s.session_id and l.clicked_at >= s.created_at and l.clicked_at <= s.created_at + interval '30 minutes') as linked
  from s
), per_session as (
  select query_text, session_id, count(*) n, bool_or(positive) positive, bool_or(product) product, bool_or(linked) linked
  from per_search group by 1,2
)
select p.query_text,
  (select count(*) from s where s.query_text = p.query_text) as search_events,
  count(*)::bigint as search_sessions,
  max(n)::bigint as top_session_events,
  array_agg(session_id) as session_ids,
  coalesce(array_agg(session_id) filter (where positive), '{}') as positive_session_ids,
  coalesce(array_agg(session_id) filter (where product), '{}') as product_session_ids,
  coalesce(array_agg(session_id) filter (where linked), '{}') as linked_session_ids,
  (select count(*) from u where u.event_type='no_answer' and u.query_text = p.query_text) as no_answer_events,
  (select count(*) from u where u.event_type='error' and u.query_text = p.query_text) as error_events,
  (select min(created_at) from s where s.query_text = p.query_text) as first_seen,
  (select max(created_at) from s where s.query_text = p.query_text) as last_seen
from per_session p
group by p.query_text
$$;

-- Products behind LINKED exits (I↔O exact join), the only decision-grade product demand signal.
create or replace function public.founder_product_demand(p_start timestamptz, p_end timestamptz)
returns table (
  canonical_product_id uuid, interactions bigint, sessions bigint, stores text[], channels text[],
  first_linked_at timestamptz, last_linked_at timestamptz
) language sql stable as $$
select o.canonical_product_id,
  count(distinct o.interaction_id) as interactions,
  count(distinct nullif(o.session_id,'')) as sessions,
  array_agg(distinct o.store_name) filter (where o.store_name is not null) as stores,
  array_agg(distinct coalesce(o.campaign->>'utm_source','unknown')) as channels,
  min(o.clicked_at), max(o.clicked_at)
from outbound_clicks o join first_party_interactions i using (interaction_id)
where o.is_test = false and i.is_test = false
  and o.clicked_at >= p_start and o.clicked_at < p_end and i.created_at >= p_start and i.created_at < p_end
  and o.canonical_product_id is not null
group by o.canonical_product_id
$$;

-- Store × channel × campaign proof stages on the /go ledger.
create or replace function public.founder_store_funnel(p_start timestamptz, p_end timestamptz)
returns table (
  store_name text, utm_source text, utm_campaign text,
  raw_rows bigint, rows_with_session bigint, linked_interactions bigint, linked_sessions bigint, products bigint
) language sql stable as $$
select o.store_name, coalesce(o.campaign->>'utm_source','unknown'), coalesce(o.campaign->>'utm_campaign','unknown'),
  count(*) as raw_rows,
  count(*) filter (where nullif(o.session_id,'') is not null) as rows_with_session,
  count(distinct o.interaction_id) filter (where i.interaction_id is not null) as linked_interactions,
  count(distinct nullif(o.session_id,'')) filter (where i.interaction_id is not null) as linked_sessions,
  count(distinct o.canonical_product_id) as products
from outbound_clicks o
left join first_party_interactions i on i.interaction_id = o.interaction_id and i.is_test = false
  and i.created_at >= p_start and i.created_at < p_end
where o.is_test = false and o.clicked_at >= p_start and o.clicked_at < p_end
group by 1,2,3
$$;

-- Client-side exit intent by store (usage_events.store — a slug/name written by the UI).
create or replace function public.founder_store_go_clicks(p_start timestamptz, p_end timestamptz)
returns table (store text, events bigint, sessions bigint) language sql stable as $$
select coalesce(store,'unknown'), count(*), count(distinct nullif(session_id,''))
from usage_events where is_test=false and event_type in ('go_click','category_go_click')
  and created_at >= p_start and created_at < p_end
group by 1
$$;

-- Daily series (Riyadh calendar days, UTC+3, no DST).
create or replace function public.founder_daily_series(p_start timestamptz, p_end timestamptz)
returns table (
  day date, browsers bigint, visits_30m bigint, search_sessions bigint, positive_result_sessions bigint,
  product_view_events bigint, go_click_events bigint, linked_interactions bigint, raw_outbound_rows bigint
) language sql stable as $$
with u as (
  select id, event_type, nullif(session_id,'') as session_id, query_text, created_at, meta,
         ((created_at + interval '3 hours') at time zone 'UTC')::date as day
  from usage_events where is_test=false and created_at >= p_start and created_at < p_end
), visits as (
  select day, session_id,
    case when lag(created_at) over (partition by session_id order by created_at, id) is null
           or created_at - lag(created_at) over (partition by session_id order by created_at, id) > interval '30 minutes'
         then 1 else 0 end as starts
  from u where session_id is not null
), s as (select * from u where event_type in ('search','advisor_query') and session_id is not null),
pos as (
  select distinct s.day, s.session_id from s where exists (
    select 1 from u r where r.session_id=s.session_id and r.query_text=s.query_text and r.event_type in ('results','advisor_result')
      and coalesce(founder_meta_num(r.meta,'count'),0) > 0 and r.created_at >= s.created_at and r.created_at <= s.created_at + interval '30 minutes')
), l as (
  select ((o.clicked_at + interval '3 hours') at time zone 'UTC')::date as day, o.interaction_id
  from outbound_clicks o join first_party_interactions i using (interaction_id)
  where o.is_test=false and i.is_test=false and o.clicked_at >= p_start and o.clicked_at < p_end and i.created_at >= p_start and i.created_at < p_end
), o as (
  select ((clicked_at + interval '3 hours') at time zone 'UTC')::date as day, id from outbound_clicks
  where is_test=false and clicked_at >= p_start and clicked_at < p_end
), days as (
  select d::date as day from generate_series(((p_start + interval '3 hours') at time zone 'UTC')::date, ((p_end - interval '1 millisecond' + interval '3 hours') at time zone 'UTC')::date, interval '1 day') d
)
select days.day,
  (select count(distinct session_id) from u where u.day = days.day),
  (select coalesce(sum(starts),0) from visits where visits.day = days.day),
  (select count(distinct session_id) from s where s.day = days.day),
  (select count(*) from pos where pos.day = days.day),
  (select count(*) from u where u.day = days.day and event_type='product_view'),
  (select count(*) from u where u.day = days.day and event_type in ('go_click','category_go_click')),
  (select count(distinct interaction_id) from l where l.day = days.day),
  (select count(*) from o where o.day = days.day)
from days order by days.day
$$;

revoke all on function public.founder_meta_num(jsonb, text) from public, anon, authenticated;
revoke all on function public.founder_window_metrics(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.founder_query_demand(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.founder_product_demand(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.founder_store_funnel(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.founder_store_go_clicks(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.founder_daily_series(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.founder_meta_num(jsonb, text) to service_role;
grant execute on function public.founder_window_metrics(timestamptz, timestamptz) to service_role;
grant execute on function public.founder_query_demand(timestamptz, timestamptz) to service_role;
grant execute on function public.founder_product_demand(timestamptz, timestamptz) to service_role;
grant execute on function public.founder_store_funnel(timestamptz, timestamptz) to service_role;
grant execute on function public.founder_store_go_clicks(timestamptz, timestamptz) to service_role;
grant execute on function public.founder_daily_series(timestamptz, timestamptz) to service_role;

-- Journey linking (opportunity 3 of the founder-decisions study): the click leg of a search
-- journey can now carry the client-minted query_id. Nullable, additive; every historical row is
-- NULL and is never backfilled or guessed.
alter table public.first_party_interactions add column if not exists query_id text;

-- ─────────────────────────────────────────────────────────────────────────────
-- B. WRITE TABLES (founder ledgers)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.founder_metric_snapshots (
  id                 bigserial primary key,
  metric_id          text not null,
  definition_version text not null,
  window_kind        text not null,            -- day | 7d | 30d | month | custom
  window_start       timestamptz not null,
  window_end         timestamptz not null,
  timezone           text not null default 'Asia/Riyadh',
  numerator          numeric,
  denominator        numeric,
  unit               text not null,
  coverage_state     text not null default 'complete',  -- complete | partial | coverage_missing | unavailable
  computed_at        timestamptz not null default now(),
  last_event_at      timestamptz,
  query_hash         text,
  snapshot_run_id    uuid not null,
  meta               jsonb,
  unique (metric_id, definition_version, window_kind, window_start, window_end, snapshot_run_id)
);
create index if not exists founder_metric_snapshots_lookup_idx on public.founder_metric_snapshots (metric_id, window_kind, window_start desc);

create table if not exists public.founder_expenses (
  id                   uuid primary key default gen_random_uuid(),
  vendor               text not null,
  description          text,
  category             text not null check (category in ('hosting','data_extraction','ai','tools','advertising','design','contractor','fees','other')),
  service_period_start date not null,
  service_period_end   date not null,
  due_at               date,
  paid_at              date,
  payment_status       text not null default 'paid' check (payment_status in ('paid','due')),
  amount_original      numeric(14,2) not null check (amount_original >= 0),
  currency             text not null default 'SAR',
  fees                 numeric(14,2) not null default 0,
  tax                  numeric(14,2) not null default 0,
  amount_sar           numeric(14,2),             -- null = not yet converted with a documented rate
  fx_rate              numeric(14,6),
  fx_source            text,
  campaign             text,
  project              text,
  channel              text,
  recurrence           text not null default 'one_time' check (recurrence in ('one_time','monthly','yearly','other')),
  renewal_at           date,
  evidence_ref         text,
  evidence_path        text,                      -- storage object path (private bucket founder-evidence)
  evidence_state       text not null default 'documented' check (evidence_state in ('documented','estimate')),
  cost_kind            text not null default 'direct' check (cost_kind in ('direct','shared')),
  allocation_note      text,
  import_id            uuid,
  row_hash             text,
  notes                text,
  created_by           uuid,
  created_at           timestamptz not null default now(),
  updated_by           uuid,
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  revision             integer not null default 1,
  check (service_period_end >= service_period_start)
);
create unique index if not exists founder_expenses_row_hash_idx on public.founder_expenses (row_hash) where row_hash is not null and deleted_at is null;
create index if not exists founder_expenses_period_idx on public.founder_expenses (service_period_start, service_period_end) where deleted_at is null;
create index if not exists founder_expenses_paid_idx on public.founder_expenses (paid_at) where deleted_at is null;

create table if not exists public.founder_expense_imports (
  id                 uuid primary key default gen_random_uuid(),
  file_checksum      text not null unique,
  original_filename  text,
  column_mapping     jsonb,
  row_count          integer not null default 0,
  imported_rows      integer not null default 0,
  skipped_duplicates integer not null default 0,
  rejected_rows      integer not null default 0,
  rejected_samples   jsonb,
  uploaded_by        uuid,
  created_at         timestamptz not null default now()
);

create table if not exists public.founder_revenue_entries (
  id                     uuid primary key default gen_random_uuid(),
  source                 text not null,              -- amazon_associates | noon_affiliate | other:<name>
  account_ref            text,
  report_ref             text,
  partner_txn_id         text,
  period_start           date,
  period_end             date,
  occurred_at            date,
  approved_at            date,
  paid_at                date,
  unit                   text not null default 'aggregate' check (unit in ('order','item','aggregate')),
  quantity               integer,
  sales_amount           numeric(14,2),
  commission_amount      numeric(14,2) not null,
  currency               text not null default 'SAR',
  amount_sar             numeric(14,2),
  fx_rate                numeric(14,6),
  fx_source              text,
  state                  text not null default 'declared' check (state in ('declared','matched','pending','confirmed','paid','cancelled')),
  matched_report_id      uuid,
  matched_conversion_id  uuid,
  evidence_ref           text,
  evidence_path          text,
  notes                  text,
  created_by             uuid,
  created_at             timestamptz not null default now(),
  updated_by             uuid,
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz,
  revision               integer not null default 1
);
create unique index if not exists founder_revenue_partner_txn_idx on public.founder_revenue_entries (source, partner_txn_id) where partner_txn_id is not null and deleted_at is null;
create index if not exists founder_revenue_period_idx on public.founder_revenue_entries (period_start, period_end) where deleted_at is null;

create table if not exists public.founder_funding (
  id           uuid primary key default gen_random_uuid(),
  amount       numeric(14,2) not null check (amount > 0),
  currency     text not null default 'SAR',
  amount_sar   numeric(14,2),
  funded_at    date not null,
  note         text,
  evidence_ref text,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table if not exists public.founder_budgets (
  id                 uuid primary key default gen_random_uuid(),
  category           text not null,                   -- an expense category or 'total'
  monthly_amount_sar numeric(14,2) not null check (monthly_amount_sar >= 0),
  effective_from     date not null,
  note               text,
  created_by         uuid,
  created_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create table if not exists public.founder_goals (
  id                    uuid primary key default gen_random_uuid(),
  month                 date not null,                -- first day of the Riyadh month
  metric_id             text not null,
  definition_version    text not null,
  baseline_value        numeric,
  baseline_window_start timestamptz,
  baseline_window_end   timestamptz,
  target_value          numeric not null,
  direction             text not null default 'gte' check (direction in ('gte','lte')),
  rationale             text,
  owner                 text,
  proposed_action       text,
  created_by            uuid,
  created_at            timestamptz not null default now(),
  updated_by            uuid,
  updated_at            timestamptz not null default now(),
  archived_at           timestamptz
);
create index if not exists founder_goals_month_idx on public.founder_goals (month) where archived_at is null;

-- Append-only: a goal may be edited, but never silently. Every change lands here first.
create table if not exists public.founder_goal_revisions (
  id         bigserial primary key,
  goal_id    uuid not null references public.founder_goals(id) on delete cascade,
  before     jsonb,
  after      jsonb not null,
  reason     text,
  actor      uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.founder_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.founder_summaries (
  id                 uuid primary key default gen_random_uuid(),
  kind               text not null check (kind in ('daily','monthly','on_demand')),
  period_start       timestamptz not null,
  period_end         timestamptz not null,
  timezone           text not null default 'Asia/Riyadh',
  partial            boolean not null default false,
  definition_version text not null,
  snapshot_run_id    uuid,
  deterministic      jsonb not null,
  ai                 jsonb,
  ai_status          text not null default 'disabled' check (ai_status in ('ok','unavailable','rejected','disabled')),
  ai_reason          text,
  generated_at       timestamptz not null default now()
);
create index if not exists founder_summaries_kind_idx on public.founder_summaries (kind, period_start desc);

create table if not exists public.founder_ledger_audit (
  id         bigserial primary key,
  entity     text not null,      -- expense | revenue | funding | budget | goal | setting | import
  entity_id  text not null,
  action     text not null,      -- create | update | delete | restore | import
  before     jsonb,
  after      jsonb,
  actor      uuid,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists founder_ledger_audit_entity_idx on public.founder_ledger_audit (entity, entity_id);

-- One explicit statement per table (not a DO loop) so tests/database/rls-coverage.test.ts's static
-- scan can verify every table here enables RLS; service-role only, no anon/authenticated policy.
alter table public.founder_metric_snapshots enable row level security;
alter table public.founder_expenses enable row level security;
alter table public.founder_expense_imports enable row level security;
alter table public.founder_revenue_entries enable row level security;
alter table public.founder_funding enable row level security;
alter table public.founder_budgets enable row level security;
alter table public.founder_goals enable row level security;
alter table public.founder_goal_revisions enable row level security;
alter table public.founder_settings enable row level security;
alter table public.founder_summaries enable row level security;
alter table public.founder_ledger_audit enable row level security;
revoke all on public.founder_metric_snapshots, public.founder_expenses, public.founder_expense_imports, public.founder_revenue_entries,
  public.founder_funding, public.founder_budgets, public.founder_goals, public.founder_goal_revisions, public.founder_settings,
  public.founder_summaries, public.founder_ledger_audit from public, anon, authenticated;
grant select, insert, update, delete on public.founder_metric_snapshots, public.founder_expenses, public.founder_expense_imports,
  public.founder_revenue_entries, public.founder_funding, public.founder_budgets, public.founder_goals, public.founder_goal_revisions,
  public.founder_settings, public.founder_summaries, public.founder_ledger_audit to service_role;
grant usage, select on sequence public.founder_metric_snapshots_id_seq to service_role;
grant usage, select on sequence public.founder_goal_revisions_id_seq to service_role;
grant usage, select on sequence public.founder_ledger_audit_id_seq to service_role;

-- Seeds: the historical tools budget is an ADJUSTABLE budget line, never a fact about spend.
insert into public.founder_budgets (category, monthly_amount_sar, effective_from, note)
select 'tools', 1300, date '2026-09-01', 'ميزانية أدوات مستهدفة تاريخيًا (نحو 1300 ريال/شهر) — قابلة للضبط، ليست مصروفًا فعليًا'
where not exists (select 1 from public.founder_budgets where category='tools' and deleted_at is null);
insert into public.founder_settings (key, value) values
  ('summary_hour_riyadh', '8'::jsonb),
  ('scenario_inputs', '{}'::jsonb)
on conflict (key) do nothing;

-- ROLLBACK (safe, additive-only; run in this order):
--   drop table if exists public.founder_ledger_audit, public.founder_summaries, public.founder_settings,
--     public.founder_goal_revisions, public.founder_goals, public.founder_budgets, public.founder_funding,
--     public.founder_revenue_entries, public.founder_expense_imports, public.founder_expenses,
--     public.founder_metric_snapshots;
--   drop function if exists public.founder_daily_series(timestamptz,timestamptz), public.founder_store_go_clicks(timestamptz,timestamptz),
--     public.founder_store_funnel(timestamptz,timestamptz), public.founder_product_demand(timestamptz,timestamptz),
--     public.founder_query_demand(timestamptz,timestamptz), public.founder_window_metrics(timestamptz,timestamptz),
--     public.founder_meta_num(jsonb,text);
--   alter table public.first_party_interactions drop column if exists query_id;
