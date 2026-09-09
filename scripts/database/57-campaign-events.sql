-- 57-campaign-events.sql — Merchant Affiliate Campaign Engine, event/claim extension
-- (Sept 2026 founder mission: "reusable across National Day, Founding Day, Ramadan,
-- White Friday... not hard-coded to Amazon/Noon/National Day").
--
-- Purely additive to the EXISTING affiliate_campaigns table (migration 44) — no new
-- table, no duplicate campaign system (per this mission's own explicit instruction).
-- All new columns are nullable: every one of the 10 existing rows keeps working
-- unmodified, and every existing query/type that does not know about these columns is
-- unaffected.
--
-- WHY ON affiliate_campaigns AND NOT A NEW "campaign_events" TABLE: an "event" here is
-- just an optional GROUPING TAG plus an optional MERCHANT-CLAIM record on top of a row
-- that is otherwise identical to every other campaign row (same eligibility engine,
-- same click/exposure tracking, same claim-guard, same admin CRUD). `event_slug` lets
-- multiple merchant rows (one Amazon, one Noon) share one seasonal identity
-- ("national_day_96") without inventing a second authority to keep in sync with the
-- first. A real join table would be justified the day an event needs its OWN fields
-- unrelated to any single merchant row (e.g. a cross-merchant countdown) — not before.
--
-- MERCHANT CLAIM vs TAWVEERI EVIDENCE (mission §20) — the four `official_claim_*`
-- columns exist ONLY to hold the MERCHANT'S OWN quoted marketing wording and its
-- source, kept structurally separate from `title_ar`/`title_en` (Tawveeri's own card
-- copy, already claim-guard-checked) and separate from any independently-computed
-- price-history evidence (tps_listing_price_facts / home-verified-deals.ts, untouched
-- by this migration). `claim_verified_at` is NULL by default — the founder report for
-- this mission found NO live, real Amazon/Noon National Day 96 claim as of 2026-09-09,
-- and Amazon's own Associates Program Operating Agreement forbids advertising a
-- sale/discount that is not confirmed via real-time merchant data — so this migration
-- intentionally ships with every `official_claim_*` column NULL for existing rows. A
-- row must never render a merchant-claim banner while `claim_verified_at` is NULL; the
-- application layer enforces this (src/lib/campaigns/store.ts), not a DB constraint,
-- matching every other claim-safety rule in this codebase (claim-guard, destination
-- validation).
alter table public.affiliate_campaigns
  add column if not exists event_slug text,
  add column if not exists event_theme text,
  add column if not exists official_claim_ar text,
  add column if not exists official_claim_en text,
  add column if not exists official_claim_source text,
  add column if not exists claim_verified_at timestamptz;

comment on column public.affiliate_campaigns.event_slug is
  'Optional seasonal/event identity shared by multiple merchant rows (e.g. "national_day_96", "white_friday_2027"). NULL = an evergreen, event-less campaign (the current 10 rows). The engine itself never branches on a specific slug value.';
comment on column public.affiliate_campaigns.event_theme is
  'Optional visual theme key for the event (e.g. "national_day"). Purely a styling hook for the campaign page — no business logic reads it.';
comment on column public.affiliate_campaigns.official_claim_ar is
  'The MERCHANT''S OWN quoted marketing claim, verbatim, in Arabic (e.g. "خصم يصل إلى 30% على منتجات مختارة"). Structurally separate from title_ar (Tawveeri''s own claim-guard-checked copy). NULL until a real claim is sourced and verified — never fabricated, never inferred from a coupon-aggregator site.';
comment on column public.affiliate_campaigns.official_claim_en is
  'English counterpart of official_claim_ar. Same NULL-until-verified rule.';
comment on column public.affiliate_campaigns.official_claim_source is
  'Where the claim was sourced — an official merchant page/press release/API only (e.g. "amazon.sa National Day node, screenshot 2026-09-20"). Never a third-party coupon-aggregator site (Amazon Associates Program Operating Agreement forbids advertising a sale not confirmed via real-time merchant data).';
comment on column public.affiliate_campaigns.claim_verified_at is
  'When a human last confirmed official_claim_ar/en against the live official source above. NULL = no verified claim exists; the campaign page must render its generic evergreen framing, never a claim banner, while this is NULL.';

-- The placement CHECK constraint (migration 44) is a deliberate two-value+both
-- allowlist, the same kind of explicit approval gate as AFFILIATE_CAMPAIGNS_MERCHANTS
-- — widened here, not removed, to add exactly one new surface this mission builds:
-- a dedicated, evergreen merchant campaign page (distinct from the homepage slot and
-- the post-search inline hint). 'both' keeps its existing, unchanged meaning
-- (homepage + post_search) — a campaign_page row must opt in explicitly.
alter table public.affiliate_campaigns drop constraint if exists affiliate_campaigns_placement_check;
alter table public.affiliate_campaigns add constraint affiliate_campaigns_placement_check
  check (placement in ('homepage', 'post_search', 'both', 'campaign_page'));

create index if not exists affiliate_campaigns_event_slug_idx
  on public.affiliate_campaigns (event_slug)
  where event_slug is not null;
