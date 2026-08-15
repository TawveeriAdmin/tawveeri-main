-- 32-demand-radar.sql — Real-Time Consumer Demand Radar (ADR-247, 2026-08-15)
--
-- ONE table: a discovered public purchase-intent moment, classified and ranked,
-- waiting for a FOUNDER decision. The system never auto-replies; `status`
-- transitions are founder actions (except NEW→READY_FOR_REVIEW→EXPIRED which
-- the pipeline manages). Data minimization: only what the founder needs to
-- decide — no follower graphs, no profile dossiers, no sensitive inferences.

CREATE TABLE IF NOT EXISTS demand_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- source identity + dedup
  source text NOT NULL,                       -- 'x' | 'mock' (source two only after proof)
  source_post_id text NOT NULL,
  source_url text NOT NULL,
  author_handle text,                         -- public handle only
  thread_key text,                            -- conversation/thread dedup key
  post_text text NOT NULL,                    -- necessary excerpt only (<= 1000 chars)
  post_lang text,
  -- latency ledger (§6): posted → seen → classified → alerted
  source_posted_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  classified_at timestamptz,
  alerted_at timestamptz,
  -- classification
  category text,                              -- production category key (tps projection)
  intent_class text,                          -- recommendation|comparison|budget|replacement|suitability|price_where|timing|other|none
  intent_strength text,                       -- strong|weak|none
  ksa_relevance text NOT NULL DEFAULT 'unknown',  -- confirmed|likely|unknown|not_relevant
  answerability text NOT NULL DEFAULT 'unknown',  -- yes|partial|no|unknown
  tier text NOT NULL DEFAULT 'ignore',        -- high|medium|ignore
  score_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,  -- decomposed WHY (Arabic strings)
  -- founder-facing product
  suggested_query text,                       -- the Tawveeri search the consumer should try
  suggested_reply text,                       -- drafted Saudi reply (LLM; null if drafting failed)
  tracking_url text,                          -- clean /r/<short> link for the manual reply
  short_id text UNIQUE,                       -- /r/<short_id>
  -- workflow (smallest valid state model, §22)
  status text NOT NULL DEFAULT 'new',         -- new|ready_for_review|approved|changes_requested|dismissed|replied_manually|expired
  founder_note text,
  -- isolation + bookkeeping
  is_test boolean NOT NULL DEFAULT false,
  raw jsonb,                                  -- minimal source payload for audit (no dossiers)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_post_id)
);

CREATE INDEX IF NOT EXISTS idx_demand_opps_status ON demand_opportunities (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demand_opps_tier ON demand_opportunities (tier, is_test, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demand_opps_thread ON demand_opportunities (thread_key);
CREATE INDEX IF NOT EXISTS idx_demand_opps_category ON demand_opportunities (category, is_test);

-- RLS: service-role only — founder surfaces read via server components/APIs.
ALTER TABLE demand_opportunities ENABLE ROW LEVEL SECURITY;

-- Radar source cursor (since_id per source) — one row per source.
CREATE TABLE IF NOT EXISTS demand_radar_state (
  source text PRIMARY KEY,
  cursor text,                                -- e.g. X since_id
  last_poll_at timestamptz,
  last_poll_status text,                      -- ok | source_unavailable | unconfigured | error:<detail>
  last_poll_candidates int,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE demand_radar_state ENABLE ROW LEVEL SECURITY;
