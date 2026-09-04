-- 47-campaign-destination-mode.sql — Amazon Decision Layer V2 §6 (Measurement V2).
--
-- Purely additive: two nullable text columns on the two existing campaign measurement
-- tables (44-affiliate-campaigns.sql), no backfill of a claim we can't verify. Every
-- LIVE campaign today is CATEGORY mode (the only mode actually wired into
-- src/lib/campaigns/store.ts's getEligibleCampaigns()), so new rows are stamped
-- 'category' by the application at write time; historical rows before this migration
-- are left NULL rather than guessed, since "we know it was category mode" is a true
-- historical fact but "we know it was written by code that stamped that value" is not —
-- unknown beats incorrect (CLAUDE.md).
--
-- Does NOT alter affiliate_campaigns, campaign eligibility, ranking, matching, or any
-- existing column. Does NOT touch the 3 disabled campaign rows or activate anything.

alter table public.campaign_exposures
  add column if not exists destination_mode text
    check (destination_mode is null or destination_mode in ('exact_product', 'model_search', 'category'));

alter table public.campaign_clicks
  add column if not exists destination_mode text
    check (destination_mode is null or destination_mode in ('exact_product', 'model_search', 'category')),
  add column if not exists canonical_product_id uuid;

create index if not exists campaign_clicks_destination_mode_idx on public.campaign_clicks (destination_mode);
