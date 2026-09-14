-- 032 — Samsung KSA New-Model Delta Watch (2026-09-14, maintenance-of-closure mission).
--
-- WHY THIS EXISTS. The Samsung Saudi official-catalog denominator (927 raw sitemap
-- candidates -> 404 core + 5 high-value accessories = 409 current-valid identities,
-- ADR-354 through ADR-361) is CLOSED. Keeping it current without re-running that whole
-- classification on every check requires a durable memory of what was ALREADY seen and
-- what it turned out to be — otherwise every future run re-fetches and re-classifies
-- ~900 known-non-product URLs (marketing, B2B, duplicates, historical 404s) just to find
-- the rare genuinely-new one. `tps_identity_staging` only records evidence for URLs that
-- became a real product; it has no row at all for a marketing page or a duplicate, so it
-- cannot answer "have we already decided this URL is not a product" — that is the
-- specific, narrow gap this table fills. Samsung-scoped by design (table name, not a
-- generic multi-merchant mechanism) — this mission is Samsung Saudi only.
create table if not exists samsung_official_url_baseline (
  official_url          text        primary key,
  model_code            text,
  identity_key          text,
  category              text,
  -- Final disposition from the closed classification (or this delta watch's own
  -- validation of a newly-discovered URL). One of: CURRENT_VALID_PRODUCT,
  -- VARIANT_NAVIGATION_DUPLICATE, DUPLICATE_URL, MARKETING, BUYING_GUIDE, B2B,
  -- FAMILY_PAGE, HISTORICAL, UNSUPPORTED_CATEGORY, CONTAMINATION, BUNDLE_NON_PRODUCT,
  -- INVALID, UNKNOWN. Mutually exclusive per URL — mirrors the closed mission's own
  -- bucket vocabulary (ADR-360) so a human reading this table recognizes it immediately.
  classification        text        not null,
  -- CURRENT: seen in the most recent sitemap fetch. TEMP_UNAVAILABLE / NOT_SEEN /
  -- POSSIBLY_DISCONTINUED / DISCONTINUED: conservative, evidence-gated demotion path —
  -- never a same-run deletion. See consecutive_misses.
  lifecycle_state        text        not null default 'CURRENT',
  first_seen_at          timestamptz not null default now(),
  last_seen_at           timestamptz not null default now(),
  last_validated_at      timestamptz,
  -- Consecutive delta-watch runs in which this URL was absent from the live sitemap.
  -- Requires several before lifecycle_state is ever demoted past NOT_SEEN — "no flapping,
  -- no automatic deletion after one miss" is a hard founder requirement for this mission.
  consecutive_misses    integer     not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists samsung_official_url_baseline_identity_idx
  on samsung_official_url_baseline (identity_key);
create index if not exists samsung_official_url_baseline_lifecycle_idx
  on samsung_official_url_baseline (lifecycle_state);

-- Constitution: every table enables RLS in its schema definition. This is pipeline
-- state, not customer data — service-role only, same posture as tps_current_offers
-- (028_current_offers_and_job_state.sql).
alter table samsung_official_url_baseline enable row level security;

-- One row per delta-watch run — the observability contract the founder needs to answer
-- "did Samsung launch anything new since the last run" without forensic work.
create table if not exists samsung_delta_watch_runs (
  id                     bigint generated always as identity primary key,
  run_id                 uuid        not null default gen_random_uuid(),
  started_at             timestamptz not null default now(),
  finished_at            timestamptz,
  sitemap_urls_seen      integer,
  known_urls             integer,
  delta_urls             integer,
  new_products           integer,
  new_variants           integer,
  new_url_same_product   integer,
  updated_existing       integer,
  duplicates             integer,
  invalid                integer,
  failed                 integer,
  user_visible_completed integer,
  status                 text        not null default 'running', -- running | completed | failed
  notes                  jsonb       not null default '{}'::jsonb
);

create index if not exists samsung_delta_watch_runs_started_idx
  on samsung_delta_watch_runs (started_at desc);

alter table samsung_delta_watch_runs enable row level security;
