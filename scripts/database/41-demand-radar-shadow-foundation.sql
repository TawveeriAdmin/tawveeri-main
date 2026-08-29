-- 41-demand-radar-shadow-foundation.sql — Radar 2.0 Phase 2, Checkpoint 1
-- (founder decision 2026-08-29): the isolated Shadow foundation.
--
-- TWO physically separate tables — architecture doc §C2's resolved decision
-- (Option A, not a shared table with a discriminator column). They mirror
-- demand_radar_funnel_events / demand_radar_outcomes exactly in shape, but
-- share ZERO write path, ZERO uniqueness constraint, and ZERO foreign key
-- with Phase 1's tables. Shadow code never references
-- demand_radar_funnel_events or demand_radar_outcomes as a write target —
-- verified by a static test (tests/growth/shadow-isolation.test.ts).
--
-- Same de-identification contract as Phase 1: neither table ever holds
-- post_text / author_handle / source_url / tracking_url / raw source_post_id
-- — the only join key across tracks is `fingerprint` (the same one-way HMAC
-- scheme, deliberately not re-salted per track, so the same underlying post
-- hashes identically in both — a feature for cross-track joins, not a risk,
-- since the fingerprint itself cannot be reversed to the original post).

CREATE TABLE IF NOT EXISTS demand_radar_shadow_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text,
  source text NOT NULL,
  domain text,
  category text,
  stage text NOT NULL,
  detail text,
  opportunity_score integer,
  answerability_status text,
  query_family text NOT NULL DEFAULT 'CONTROL_PARITY_V1',
  is_test boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_radar_shadow_funnel_stage_time ON demand_radar_shadow_funnel_events (stage, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_shadow_funnel_fingerprint ON demand_radar_shadow_funnel_events (fingerprint);
CREATE INDEX IF NOT EXISTS idx_radar_shadow_funnel_category_day ON demand_radar_shadow_funnel_events (source, category, occurred_at DESC);

ALTER TABLE demand_radar_shadow_funnel_events ENABLE ROW LEVEL SECURITY;

-- One row per Shadow candidate. `retrieved_by_radar1` is the would_radar1_
-- retrieve() replay result (Checkpoint 4) — the core Control/Treatment
-- comparison field. `shadow_review_label` is written only by the Checkpoint 3
-- review surface — a DIFFERENT, Shadow-specific vocabulary from Phase 1's
-- founder_outcome ('valuable' | 'not_a_lead' | 'exclusion_noise' |
-- 'cannot_answer' | 'draft_quality_issue'), deliberately not reusing that
-- column name so the two are never confused.
CREATE TABLE IF NOT EXISTS demand_radar_shadow_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text UNIQUE,
  tier text,
  domain text,
  category text,
  intent_type text,
  buying_stage text,
  exclusion text,
  opportunity_score integer,
  answerability_status text,
  query_family text NOT NULL DEFAULT 'CONTROL_PARITY_V1',
  is_test boolean NOT NULL DEFAULT false,
  retrieved_by_radar1 boolean,
  shadow_review_label text,
  shadow_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_radar_shadow_outcomes_review ON demand_radar_shadow_outcomes (shadow_review_label, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_shadow_outcomes_category ON demand_radar_shadow_outcomes (category, retrieved_by_radar1);

ALTER TABLE demand_radar_shadow_outcomes ENABLE ROW LEVEL SECURITY;
