-- 40-demand-radar-funnel-observability.sql — Radar 2.0 Phase 1 (founder
-- decision 2026-08-29): full-funnel, de-identified event observability.
--
-- NOT YET APPLIED. Written for founder review at the deployment checkpoint.
--
-- Two new, fully additive tables. NEITHER ever holds post_text, author_handle,
-- source_url, tracking_url, or a raw source_post_id — the only join key is
-- `fingerprint`, a one-way HMAC computed in application code
-- (heuristics.ts::candidateFingerprint), never a value that resolves to a
-- public URL on its own. Same RLS posture as every existing Demand Radar
-- table (32/33/38/39): service-role only, zero policies.

CREATE TABLE IF NOT EXISTS demand_radar_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text,                            -- one-way HMAC; null = unconfigured secret (explicit, never a guessed value)
  source text NOT NULL,                        -- 'x' | 'mock'
  domain text,                                 -- 'product' | 'home_mission' | 'housing_partnership' | 'brand_mention' | 'other'
  category text,                                -- production category key or null
  stage text NOT NULL,                          -- see FUNNEL_STAGES in types.ts
  detail text,                                  -- small enum context (which prefilter gate / exclusion class / founder action)
  opportunity_score integer,                    -- independent Purchase/Market Opportunity Score (§10) — nullable, stage-dependent
  answerability_status text,                    -- 'yes' | 'partial' | 'no' | 'unknown' — nullable, stage-dependent
  query_family text NOT NULL DEFAULT 'PRODUCT_DIRECT_PURCHASE_V1', -- Phase 1: one constant value; forward-compatible column for §6's real families
  is_test boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_radar_funnel_stage_time ON demand_radar_funnel_events (stage, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_funnel_fingerprint ON demand_radar_funnel_events (fingerprint);
CREATE INDEX IF NOT EXISTS idx_radar_funnel_category_day ON demand_radar_funnel_events (source, category, occurred_at DESC);

ALTER TABLE demand_radar_funnel_events ENABLE ROW LEVEL SECURITY;

-- One row per opportunity that reaches a founder-facing tier (medium/high),
-- upserted on `fingerprint` so the initial ranking write and a later
-- founder-action/expiry write land on the SAME row rather than two.
CREATE TABLE IF NOT EXISTS demand_radar_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text UNIQUE,                      -- unique for upsert target; null rows (unconfigured secret) insert independently, never collide
  tier text NOT NULL,                            -- 'high' | 'medium' | 'ignore'
  domain text,
  category text,
  intent_type text,
  buying_stage text,
  exclusion text,
  opportunity_score integer,
  answerability_status text,
  query_family text NOT NULL DEFAULT 'PRODUCT_DIRECT_PURCHASE_V1',
  is_test boolean NOT NULL DEFAULT false,
  founder_outcome text,                          -- null (no verdict yet) | 'accepted' | 'rejected' | 'expired_no_review'
  founder_outcome_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_radar_outcomes_precision ON demand_radar_outcomes (tier, founder_outcome, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_outcomes_category ON demand_radar_outcomes (category, tier);

ALTER TABLE demand_radar_outcomes ENABLE ROW LEVEL SECURITY;

-- Additive, nullable four-axis taxonomy columns on the existing table —
-- non-breaking, same pattern as migration 39's `opportunity_type` addition.
-- Observational only in Phase 1: nothing reads these to make a real tier/
-- email decision (see rank.ts's Phase 1 note).
ALTER TABLE demand_opportunities
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS buying_stage text,
  ADD COLUMN IF NOT EXISTS intent_type text,
  ADD COLUMN IF NOT EXISTS exclusion_class text;
