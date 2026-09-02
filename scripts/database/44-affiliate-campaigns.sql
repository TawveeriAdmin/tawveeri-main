-- 44-affiliate-campaigns.sql — Affiliate Campaign Revenue Layer V1.
-- NOT YET APPLIED TO PRODUCTION (as of the final pre-deploy closure round).
--
-- A small, reversible commercial layer on top of the EXISTING provider/affiliate
-- framework (ADR-085/224). It does NOT touch decision-engine.ts, route-query.ts,
-- evidence-engine.ts, ranking, matching, or canonical product rules.
--
-- CLICK ARCHITECTURE (revised in the final closure round — "B", not "A"): the
-- affiliate-tagged merchant URL is built SERVER-SIDE at IMPRESSION time
-- (src/lib/campaigns/store.ts, reusing buildOfferExitLink()/getProvider() from
-- src/lib/providers — the same tag logic already live for Amazon/Noon) and embedded
-- directly in the card as its href. The browser navigates to the merchant DIRECTLY —
-- there is no `/go/campaign/[id]` redirect hop, so a bare GET can no longer increment
-- a "click" the way the /go anomaly did. A real click instead fires a token-verified
-- POST to /api/campaigns/click (src/lib/campaigns/click-token.ts) purely for
-- measurement, writing to THIS table — never outbound_clicks — so campaign traffic
-- stays structurally isolated from the /go measurement anomaly under active
-- investigation (docs/report/SEPTEMBER-2026-EXECUTION-BASELINE.md §A.3/N.1) in both
-- directions.
--
-- AMAZON SUB-TAG AUDIT (final closure round §2): no per-click/session/user identifier
-- is generated or sent to Amazon in this path (ascsubtag is never set) — third-party
-- documentation describes ascsubtag as an invitation-only Amazon feature requiring an
-- explicit grant, and no evidence exists that Tawveeri's account has one. Attribution
-- is CAMPAIGN-LEVEL only, via the optional `tracking_id` column below (falls back to
-- the shared org-wide tag, tawveeri0f-21, until the founder mints a dedicated one).
--
-- V1 restricts `merchant` to amazon/noon at the DB level — no ArabClicks/Skimlinks/
-- Sovrn/CJ/Awin/other intermediary without a separate founder-approved migration.
--
-- Both tables: service_role only (matches growth_content, 31-growth-attribution.sql).
-- All reads happen server-side (service role client) — no anon/authenticated grant is
-- needed because no client ever queries these tables directly (getHomeVerifiedDeals
-- precedent: src/lib/intelligence/home-verified-deals.ts).

create table if not exists public.affiliate_campaigns (
  id               uuid primary key default gen_random_uuid(),
  merchant         text not null check (merchant in ('amazon', 'noon')),
  title_ar         text not null,
  title_en         text not null,
  cta_ar           text not null default 'استعرض العرض',
  cta_en           text not null default 'View offer',
  -- The raw merchant destination (category/campaign page or product page), BEFORE
  -- affiliate-tag injection — buildOfferExitLink() applies the tag at click time,
  -- exactly like every other exit, so a tag rotation never requires editing a
  -- campaign row. Validated against an approved-host allowlist in the app layer
  -- (src/lib/campaigns/destination-validation.ts) on every insert/update.
  destination_url  text not null,
  -- Campaign-level Amazon Tracking ID / Noon program tag override (final closure round
  -- §2/D). NULL = use the provider's shared default (tawveeri0f-21 for Amazon, the
  -- existing "Everyday Campaign" params for Noon). Never a per-user/session identifier
  -- — this is a static, admin-entered string shared by every click on this campaign.
  tracking_id      text,
  -- ProductCategory strings (src/lib/database/types.ts — a loose string type).
  -- Empty array = homepage-only / not category-gated for post-search placement.
  categories       text[] not null default '{}',
  placement        text not null check (placement in ('homepage', 'post_search', 'both')),
  enabled          boolean not null default false,
  start_at         timestamptz not null,
  end_at           timestamptz not null,
  -- When a human last confirmed destination_url is a real, live, current campaign
  -- (Phase 4 — no self-purchase validation; a manual link check is the allowed
  -- minimum verification). Not enforced by a query; a founder-facing admin field.
  verified_at      timestamptz,
  -- Free-text provenance: "Associates Central dashboard 2026-09-02", "Noon Everyday
  -- Campaign C1000264L", etc. Never fabricated — unknown beats incorrect.
  source           text,
  disclosure_ar    text not null default 'مادة إعلانية • رابط عمولة',
  disclosure_en    text not null default 'Advertisement • Commission link',
  -- Internal/dry-run campaigns excluded from real business metrics, same convention
  -- as outbound_clicks.is_test / usage_events.is_test.
  is_test          boolean not null default false,
  created_by       uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint affiliate_campaigns_window_valid check (end_at > start_at)
);

create index if not exists affiliate_campaigns_placement_idx on public.affiliate_campaigns (placement) where enabled = true;
create index if not exists affiliate_campaigns_window_idx on public.affiliate_campaigns (start_at, end_at) where enabled = true;
create index if not exists affiliate_campaigns_merchant_idx on public.affiliate_campaigns (merchant);

create or replace function public.set_affiliate_campaigns_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_affiliate_campaigns_updated_at on public.affiliate_campaigns;
create trigger trigger_affiliate_campaigns_updated_at
  before update on public.affiliate_campaigns
  for each row
  execute function public.set_affiliate_campaigns_updated_at();

alter table public.affiliate_campaigns enable row level security;
revoke all on public.affiliate_campaigns from public, anon, authenticated;
grant select, insert, update, delete on public.affiliate_campaigns to service_role;

-- campaign_clicks — the AUTHORITATIVE ledger for campaign clicks, written by
-- POST /api/campaigns/click (src/app/api/campaigns/click/route.ts) after verifying a
-- short-lived impression-bound token (src/lib/campaigns/click-token.ts). The browser
-- navigates to the merchant directly via the card's own href — this insert is pure
-- measurement and NEVER gates or delays that navigation. Kept as its own table (not a
-- row in outbound_clicks) so a founder auditing "did the /go anomaly touch
-- commercial-campaign numbers" can answer "structurally impossible."
--
-- sub_id is intentionally always NULL in V1 (kept, not dropped, for a possible V2 that
-- reintroduces impression-scoped — never click-scoped or personal — sub-attribution
-- once/if the merchant's program is confirmed to explicitly support it). affiliate_tag
-- records which tracking_id/program a click's pre-built link actually used — a shared,
-- non-personal, campaign-level value, safe to store.
--
-- DELETION BEHAVIOR (final closure round §7, deliberate): campaign_id is nullable with
-- ON DELETE SET NULL, NOT CASCADE. outbound_clicks is treated as an immutable ledger
-- elsewhere in this codebase (never deleted, never rewritten); a founder deleting a
-- campaign row from the admin UI must not silently destroy its click history to match
-- that same principle — the click rows survive as orphaned-but-intact records.
create table if not exists public.campaign_clicks (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         uuid references public.affiliate_campaigns(id) on delete set null,
  merchant            text not null,
  placement           text not null,
  category            text,
  destination_url     text not null,
  affiliate_program   text,
  affiliate_tag       text,
  sub_id              text,
  source              text,
  session_id          text,
  -- The tw_campaign cookie (utm_source/medium/campaign/content) — same shape and
  -- meaning as outbound_clicks.campaign (ADR-244). Named acquisition_campaign here to
  -- avoid ambiguity with affiliate_campaigns/campaign_id in the same statement.
  acquisition_campaign jsonb,
  is_test             boolean not null default false,
  user_agent          text,
  referrer            text,
  ip_address          text,
  created_at          timestamptz not null default now()
);

create index if not exists campaign_clicks_campaign_id_idx on public.campaign_clicks (campaign_id);
create index if not exists campaign_clicks_created_at_idx on public.campaign_clicks (created_at);

alter table public.campaign_clicks enable row level security;
revoke all on public.campaign_clicks from public, anon, authenticated;
grant select, insert on public.campaign_clicks to service_role;

-- campaign_exposures — Revenue Proof dashboard, Phase 2B. SERVER-SIDE decision-grade
-- evidence that an eligible campaign was resolved/served for an eligible shopping
-- context (getEligibleCampaigns() in src/lib/campaigns/store.ts writes one row,
-- fire-and-forget, whenever it returns a non-empty result). Distinct from:
--   - campaign_impression (usage_events): CLIENT-side evidence the card actually
--     rendered/mounted in a browser — noisier, telemetry-only, dedup'd by track.ts.
--   - campaign_clicks: the authoritative click ledger.
-- An exposure is the narrowest, cleanest of the three — a server decision, not a
-- client report — so it is the correct denominator for "clean eligible exposures"
-- (Phase 2B item 1), never usage_events (subject to the historical duplicate-event
-- defect documented in docs/report/SEPTEMBER-2026-EXECUTION-BASELINE.md §A.1).
create table if not exists public.campaign_exposures (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid references public.affiliate_campaigns(id) on delete set null,
  merchant     text not null,
  placement    text not null,
  category     text,
  session_id   text,
  is_test      boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists campaign_exposures_campaign_id_idx on public.campaign_exposures (campaign_id);
create index if not exists campaign_exposures_created_at_idx on public.campaign_exposures (created_at);

alter table public.campaign_exposures enable row level security;
revoke all on public.campaign_exposures from public, anon, authenticated;
grant select, insert on public.campaign_exposures to service_role;
