-- 50-commercial-tiebreak-events.sql — Amazon × Noon commercial tie-break policy
-- (founder mission "Amazon × Noon Affiliate Commerce Engine", 2026-09-05, §6/§7/§17).
--
-- One row per request where BOTH an Amazon and a Noon campaign resolved to `exact_product`
-- mode for the SAME canonical product (src/lib/campaigns/store.ts's getEligibleCampaigns(),
-- src/lib/campaigns/commercial-tiebreak.ts). Purely additive, new table, no existing table
-- altered. Logging only — this table is never read by anything that decides what a shopper
-- sees; it exists so the founder's dashboard can show real tie-break outcomes instead of a
-- theoretical policy description (mission §17 "Experiment Contract": every commercial
-- merchant-selection event should be reproducible).
--
-- No backfill: no historical tie-break ever happened before this table existed (Noon had no
-- exact_product routing at all until this same change), so there is nothing to reconstruct.

create table if not exists public.campaign_tiebreak_events (
  id uuid primary key default gen_random_uuid(),
  canonical_product_id uuid not null,
  category text not null,
  session_id text,
  is_test boolean not null default false,
  amazon_price_sar numeric,
  noon_price_sar numeric,
  price_diff_sar numeric,
  equivalence_state text not null check (equivalence_state in ('SHOPPER_EQUIVALENT', 'SHOPPER_NEAR_EQUIVALENT', 'NOT_EQUIVALENT', 'UNKNOWN')),
  selected_merchant text check (selected_merchant is null or selected_merchant in ('amazon', 'noon')),
  reason_code text not null,
  created_at timestamptz not null default now()
);

create index if not exists campaign_tiebreak_events_created_at_idx on public.campaign_tiebreak_events (created_at);
create index if not exists campaign_tiebreak_events_category_idx on public.campaign_tiebreak_events (category);

-- RLS enabled, no policies — service-role only (matches Rule 10 of the data-quality
-- contract; same precedent as affiliate_campaigns/campaign_clicks/campaign_exposures).
alter table public.campaign_tiebreak_events enable row level security;
