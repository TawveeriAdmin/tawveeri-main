-- 35-shared-home-plans.sql — Pre-purchase plan sharing (ADR-257, 2026-08-17)
-- «شارك الخطة»: an anonymous capability-URL SNAPSHOT of a Home mission plan, viewable
-- without an account (W3C capability-URL doctrine; 128-bit crypto-random token), plus
-- lightweight name-prompted feedback from recipients. The owner is anonymous too:
-- feedback readback is gated by an owner_key returned ONCE at creation and stored only
-- client-side. Service-role only — RLS on, no anon grants, all access flows through
-- our API routes which validate the token server-side.

CREATE TABLE IF NOT EXISTS shared_home_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,                  -- 32 hex chars = 128 bits, crypto-random
  owner_key text NOT NULL,                     -- 128-bit secret; feedback-readback gate
  locale text NOT NULL DEFAULT 'ar',
  snapshot jsonb NOT NULL,                     -- SANITIZED plan snapshot (no free text, no PII)
  view_count integer NOT NULL DEFAULT 0,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_shared_home_plans_token ON shared_home_plans (token);

CREATE TABLE IF NOT EXISTS shared_home_plan_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES shared_home_plans(id) ON DELETE CASCADE,
  leg_id text NOT NULL,                        -- which plan item ('' = whole plan)
  reaction text NOT NULL CHECK (reaction IN ('up', 'change')),
  note text CHECK (char_length(note) <= 140),
  reviewer_name text CHECK (char_length(reviewer_name) <= 24),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_home_plan_feedback_share ON shared_home_plan_feedback (share_id, created_at DESC);

ALTER TABLE shared_home_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_home_plan_feedback ENABLE ROW LEVEL SECURITY;
-- No policies and no grants on purpose: only the service role (our server) touches these.
-- owner_key is a secret → the credential-table rule applies: Supabase's schema-default
-- grants to anon/authenticated are explicitly revoked (RLS already blocks, this is
-- defense-in-depth and was verified applied in production 2026-08-17).
REVOKE ALL ON shared_home_plans, shared_home_plan_feedback FROM anon, authenticated;
