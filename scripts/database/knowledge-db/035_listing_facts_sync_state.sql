-- 035_listing_facts_sync_state.sql — ADR-390 (Supabase egress incident, 2026-09-29)
--
-- WHY: `build-listing-facts.ts` (the hourly `facts` step of the intelligence refresh)
-- reset its cursor to 0 on EVERY run and paged the whole `raw_observations` table for
-- six stores through the Shared Pooler, once an hour. That is the read that burned the
-- organization's egress quota and took production reads dark.
--
-- This table persists a per-store watermark (the highest raw_observations.id already
-- folded into `tps_listing_price_facts`) so each run reads only what arrived since.
-- The watermark advances ONLY after the batch it covers was written; it is never reset
-- by a failure. A full rebuild is a separate, explicit, unscheduled command.
create table if not exists public.tps_listing_facts_sync (
  store_id             integer primary key,
  last_observation_id  bigint not null default 0,
  last_run_at          timestamptz,
  last_success_at      timestamptz,
  last_rows_fetched    integer,
  last_rows_written    integer,
  last_note            text,
  updated_at           timestamptz not null default now()
);

alter table public.tps_listing_facts_sync enable row level security;
alter table public.tps_listing_facts_sync force row level security;
revoke all on public.tps_listing_facts_sync from anon, authenticated;
grant all on public.tps_listing_facts_sync to service_role;

-- Exact distinct-day accounting under incremental merges: the set of ISO days already
-- counted for a listing. NULL on rows written by the old full rebuild; the incremental
-- merge seeds it from `last_seen` on first touch (src/lib/intelligence/listing-facts-merge.ts).
alter table public.tps_listing_price_facts add column if not exists observed_days date[];
