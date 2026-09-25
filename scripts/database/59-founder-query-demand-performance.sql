-- 59-founder-query-demand-performance.sql — founder_query_demand() rewritten from correlated
-- EXISTS subqueries (nested-loop seq scans; exceeded the 20s service_role statement_timeout on a
-- 30-day window, observed live on /admin/founder/demand) to hash-joinable LEFT JOIN + bool_or
-- aggregation, with the same semantics. Plus the one index every founder read benefits from:
-- usage_events had no session_id index at all. Additive, idempotent; rollback at the end.

create index if not exists usage_events_session_created_idx on public.usage_events (session_id, created_at)
  where session_id is not null and session_id <> '';

create or replace function public.founder_query_demand(p_start timestamptz, p_end timestamptz)
returns table (
  query_text text, search_events bigint, search_sessions bigint, top_session_events bigint,
  session_ids text[], positive_session_ids text[], product_session_ids text[], linked_session_ids text[],
  no_answer_events bigint, error_events bigint, first_seen timestamptz, last_seen timestamptz
) language sql stable as $$
with u as materialized (
  select id, event_type, nullif(session_id,'') as session_id, query_text, created_at,
         coalesce(founder_meta_num(meta,'count'),0) as result_count
  from usage_events where is_test = false and created_at >= p_start and created_at < p_end and nullif(session_id,'') is not null
), linked as materialized (
  select nullif(o.session_id,'') as session_id, o.clicked_at
  from outbound_clicks o join first_party_interactions i using (interaction_id)
  where o.is_test = false and i.is_test = false
    and o.clicked_at >= p_start and o.clicked_at < p_end and i.created_at >= p_start and i.created_at < p_end
    and nullif(o.session_id,'') is not null
), s as (
  select id, query_text, session_id, created_at from u
  where event_type in ('search','advisor_query') and coalesce(query_text,'') <> ''
), follow as (
  select s.id, s.query_text, s.session_id, s.created_at,
    bool_or(r.event_type in ('results','advisor_result') and r.query_text = s.query_text and r.result_count > 0) as positive,
    bool_or(r.event_type = 'product_view') as product
  from s left join u r on r.session_id = s.session_id and r.created_at >= s.created_at and r.created_at <= s.created_at + interval '30 minutes'
  group by s.id, s.query_text, s.session_id, s.created_at
), follow_linked as (
  select s.id, bool_or(l.session_id is not null) as linked
  from s left join linked l on l.session_id = s.session_id and l.clicked_at >= s.created_at and l.clicked_at <= s.created_at + interval '30 minutes'
  group by s.id
), per_search as (
  select f.query_text, f.session_id, f.created_at, f.positive, f.product, coalesce(fl.linked,false) as linked
  from follow f join follow_linked fl using (id)
), per_session as (
  select query_text, session_id, count(*) n, bool_or(positive) positive, bool_or(product) product, bool_or(linked) linked,
         min(created_at) first_at, max(created_at) last_at
  from per_search group by 1,2
), extra as (
  select query_text,
    count(*) filter (where event_type='no_answer') as no_answer_events,
    count(*) filter (where event_type='error') as error_events
  from u where coalesce(query_text,'') <> '' group by query_text
)
select p.query_text,
  sum(n)::bigint as search_events,
  count(*)::bigint as search_sessions,
  max(n)::bigint as top_session_events,
  array_agg(session_id) as session_ids,
  coalesce(array_agg(session_id) filter (where positive), '{}') as positive_session_ids,
  coalesce(array_agg(session_id) filter (where product), '{}') as product_session_ids,
  coalesce(array_agg(session_id) filter (where linked), '{}') as linked_session_ids,
  coalesce(max(e.no_answer_events),0)::bigint as no_answer_events,
  coalesce(max(e.error_events),0)::bigint as error_events,
  min(first_at) as first_seen,
  max(last_at) as last_seen
from per_session p left join extra e using (query_text)
group by p.query_text
$$;

revoke all on function public.founder_query_demand(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.founder_query_demand(timestamptz, timestamptz) to service_role;

-- ROLLBACK: re-run the founder_query_demand block of 58-founder-operating-center.sql;
--   drop index if exists public.usage_events_session_created_idx;
