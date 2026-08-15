-- 33-brand-mentions.sql — Brand Mention Watch (ADR-248, 2026-08-15)
-- FULLY SEPARATE from demand_opportunities: a mention is brand awareness,
-- never a purchase opportunity. A post can legitimately appear in both tables
-- via two independent decisions. Minimal fields, service-role only.

CREATE TABLE IF NOT EXISTS brand_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,                        -- 'x' | 'mock'
  source_post_id text NOT NULL,
  source_url text NOT NULL,
  author_handle text,
  post_text text NOT NULL,
  post_lang text,
  source_posted_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  classified_at timestamptz,
  alerted_at timestamptz,
  mention_class text NOT NULL DEFAULT 'neutral',
    -- positive | negative | question | complaint | suggestion | needs_reply | neutral
  status text NOT NULL DEFAULT 'new',          -- new | handled | dismissed
  founder_note text,
  is_test boolean NOT NULL DEFAULT false,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_post_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_mentions_status ON brand_mentions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brand_mentions_class ON brand_mentions (mention_class, is_test);

ALTER TABLE brand_mentions ENABLE ROW LEVEL SECURITY;
