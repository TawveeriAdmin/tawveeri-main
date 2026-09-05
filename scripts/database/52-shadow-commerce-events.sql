-- 52-shadow-commerce-events.sql — Noon Internal Commerce Expansion (founder mission,
-- 2026-09-05, §2/§7). Purely additive, new table.
--
-- One row per real product-detail view where at least one of Amazon/Noon has a real
-- offer, logging what the internal commercial tie-break WOULD select — mode is always
-- 'SHADOW': this table is never read by anything that decides what a shopper sees, and
-- inserting into it requires no live campaign, no NOON_EXACT_PRODUCT_ENABLED flag, and no
-- Noon-branded surface of any kind (decoupled entirely from the clause-8.3 question).
-- Distinct from campaign_tiebreak_events (migration 50), which only fires when BOTH an
-- Amazon AND a Noon CAMPAIGN independently resolve exact_product for the same request —
-- a narrower, campaign-gated trigger. This table fires on ordinary organic product views,
-- across every category, entirely independent of campaign existence.
create table if not exists public.shadow_commerce_events (
  id uuid primary key default gen_random_uuid(),
  policy_version text not null default 'shadow-v1',
  mode text not null default 'SHADOW' check (mode = 'SHADOW'),
  category text not null,
  product_id uuid not null,
  canonical_product_id uuid,
  amazon_product_url text,
  noon_product_url text,
  amazon_price_sar numeric,
  noon_price_sar numeric,
  price_delta_sar numeric,
  product_truth_state text not null check (product_truth_state in ('ACTIVE', 'ACTIVE_LOW_CONFIDENCE', 'INACTIVE')),
  freshness_state text not null check (freshness_state in ('FRESH', 'STALE', 'UNKNOWN')),
  shopper_equivalence_state text not null check (shopper_equivalence_state in ('SHOPPER_EQUIVALENT', 'SHOPPER_NEAR_EQUIVALENT', 'NOT_EQUIVALENT', 'UNKNOWN')),
  traffic_source_class text not null,
  commercial_evidence_state text not null check (commercial_evidence_state in ('KNOWN', 'UNKNOWN')),
  hypothetical_selected_merchant text check (hypothetical_selected_merchant is null or hypothetical_selected_merchant in ('amazon', 'noon')),
  selection_reason text not null,
  session_id text,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists shadow_commerce_events_created_at_idx on public.shadow_commerce_events (created_at);
create index if not exists shadow_commerce_events_category_idx on public.shadow_commerce_events (category);
create index if not exists shadow_commerce_events_product_id_idx on public.shadow_commerce_events (product_id);

-- RLS enabled, no policies — service-role only (same precedent as affiliate_campaigns /
-- campaign_clicks / campaign_exposures / campaign_tiebreak_events).
alter table public.shadow_commerce_events enable row level security;
