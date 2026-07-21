-- 019_progressive_batching.sql
-- Progressive TPS batching: durable per-(category,store) cursor + a pre-corroboration
-- identity accumulator. Separates NORMALIZATION (progressive, cursor-driven, per
-- observation) from CORROBORATION (global, grouped by identity_key across ALL
-- accumulated observations) so a product observed in an early slice can corroborate
-- with a matching product observed in a much later slice.
--
-- Milestone 7 preserved: these are internal staging/bookkeeping tables. The
-- authoritative canonical/offer writes still go exclusively through write_ac_batch.
-- Both tables enable + force RLS with NO anon/authenticated policies (deny-all);
-- only the service role (which bypasses RLS) reads/writes them.

create table if not exists public.tps_progress_cursors (
  category      text   not null,
  store_id      int    not null,
  last_raw_id   bigint not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (category, store_id)
);

create table if not exists public.tps_identity_staging (
  category      text   not null,
  raw_obs_id    bigint not null,
  store_id      int,
  identity_key  text,
  status        text,
  price         numeric,
  url           text,
  name          text,
  confidence    int,
  detected      boolean not null default true,   -- passed the category detector
  payload       jsonb  not null default '{}'::jsonb,
  observed_at   timestamptz not null default now(),
  primary key (category, raw_obs_id)
);

-- Corroboration groups by (category, identity_key); this index makes it cheap.
create index if not exists idx_tps_staging_cat_key
  on public.tps_identity_staging (category, identity_key)
  where identity_key is not null;

alter table public.tps_progress_cursors enable row level security;
alter table public.tps_progress_cursors force row level security;
alter table public.tps_identity_staging enable row level security;
alter table public.tps_identity_staging force row level security;

revoke all on public.tps_progress_cursors from anon, authenticated;
revoke all on public.tps_identity_staging from anon, authenticated;
grant all on public.tps_progress_cursors to service_role;
grant all on public.tps_identity_staging to service_role;
