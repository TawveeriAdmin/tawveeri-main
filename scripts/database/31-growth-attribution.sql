-- 31-growth-attribution.sql (ADR-244, Growth Engine Gate A)
--
-- 1. outbound_clicks learns campaign attribution + storefront-offer linkage.
--    Measured 2026-08-13: 282 REAL exits since the commercial baseline carried
--    NO session identity (the column existed, nothing wrote it) and NO campaign
--    identity (no column) — so "qualified referred sessions" read 1 while 282
--    real exits happened. `/go` now stamps session_id (from the tw_sid cookie
--    mirror) and campaign (from the tw_campaign cookie); product_store_id
--    records storefront exits that previously bypassed /go entirely.
alter table public.outbound_clicks
  add column if not exists campaign jsonb,
  add column if not exists product_store_id uuid;

-- 2. growth_content — the ONE canonical identity for growth experiments/content
--    (mission §9: experiment, content, channel, variant, campaign, landing, status).
--    Deliberately small: this is lineage + review state, not a CMS.
create table if not exists public.growth_content (
  content_id text primary key,
  experiment_id text not null,
  channel text not null,
  creative_variant text,
  hook text,
  hook_family text,                 -- problem | time_hassle | money | confusion
  title text,
  why_now text,
  evidence jsonb,                   -- {source, confidence, production_query, verified_at, ...}
  landing_url text,
  utm jsonb,                        -- the exact utm_* set for this piece
  video_url text,                   -- playable asset for founder review
  status text not null default 'draft'
    check (status in ('draft','ready_for_review','approved','changes_requested','rejected','published')),
  founder_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.growth_content enable row level security;
revoke all on public.growth_content from public, anon, authenticated;
grant select, insert, update on public.growth_content to service_role;
