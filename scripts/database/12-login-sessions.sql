-- Login sessions table for new device detection (Gap #14)
CREATE TABLE IF NOT EXISTS login_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  user_agent TEXT,
  ip_address INET,
  is_known_device BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_sessions_user ON login_sessions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_login_sessions_fingerprint ON login_sessions(user_id, device_fingerprint);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
--
-- This table was originally created WITHOUT RLS, leaving user_id, device
-- fingerprints, user agents and IP addresses readable by anyone holding the
-- public anon key.
--
-- All access is server-side via createServerClient() (service role), which
-- bypasses RLS, so deny-all changes no application behaviour.
--
-- A self-read policy is provided for `authenticated` because a user viewing
-- their own device list is a plausible near-term feature and the alternative —
-- adding it later under time pressure — is how the original omission happened.
-- It grants strictly own-row read and nothing else.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE login_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own login sessions" ON login_sessions;
CREATE POLICY "Users can view their own login sessions"
  ON login_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policy: writes are service-role only.

REVOKE ALL ON login_sessions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON login_sessions FROM authenticated;
