-- 39-demand-radar-home-mission.sql — Growth Radar Phase 2, Part B (founder
-- decision, 2026-08-26): a new, separate opportunity type for furnishing/
-- new-home-receipt intent, routed to a distinct reply template that
-- introduces جهّز بيتك instead of the per-product answerability path.
--
-- Reuses demand_opportunities as-is (same table, same status lifecycle, same
-- 24h expiry, same weekly counter) — only a discriminator column is new, so
-- 'home_mission' rows never get misread as a real TPS category (which would
-- happen if they overloaded the `category` column instead) and never pollute
-- category-keyed dashboards like topDemand() on /admin/command-center.

ALTER TABLE demand_opportunities
  ADD COLUMN IF NOT EXISTS opportunity_type text NOT NULL DEFAULT 'product';

CREATE INDEX IF NOT EXISTS idx_demand_opps_opportunity_type
  ON demand_opportunities (opportunity_type, status);
