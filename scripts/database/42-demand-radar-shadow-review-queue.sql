-- 42-demand-radar-shadow-review-queue.sql — Radar 2.0 Phase 2, Checkpoint 3
-- (founder decision 2026-08-29): the Shadow Sample Review temporary
-- content-bearing queue.
--
-- The ONLY Shadow table permitted to hold raw content — a human reviewer
-- must be able to read the actual post to judge it. Same bounded-lifecycle
-- discipline as Phase 1's demand_opportunities (24h), but 72h per the
-- architecture doc §T (review isn't real-time-driven, sized for a weekly
-- batch, still short and bounded — deletion enforced by application code,
-- mirroring pipeline.ts's existing hard-delete sweep pattern, not by this
-- migration). Never referenced by any Radar 1 code; never receives an
-- insert from Radar 1.

CREATE TABLE IF NOT EXISTS demand_radar_shadow_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL,
  source text NOT NULL,
  source_post_id text NOT NULL,
  source_url text NOT NULL,
  author_handle text,
  post_text text NOT NULL,
  post_lang text,
  source_posted_at timestamptz,
  category text,
  domain text,
  retrieved_by_radar1 boolean,
  query_family text NOT NULL DEFAULT 'CONTROL_PARITY_V1',
  is_test boolean NOT NULL DEFAULT false,
  shadow_review_label text,
  founder_note text,
  shadow_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_post_id)
);

CREATE INDEX IF NOT EXISTS idx_shadow_review_queue_pending ON demand_radar_shadow_review_queue (shadow_review_label, created_at DESC);

ALTER TABLE demand_radar_shadow_review_queue ENABLE ROW LEVEL SECURITY;
