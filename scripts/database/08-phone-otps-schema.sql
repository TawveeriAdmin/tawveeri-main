-- Phone OTPs Table for Authentica SMS Integration
-- Stores temporary OTP codes for phone authentication

CREATE TABLE IF NOT EXISTS phone_otps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE NOT NULL,
    attempts INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_phone_otps_phone ON phone_otps(phone);
CREATE INDEX IF NOT EXISTS idx_phone_otps_expires_at ON phone_otps(expires_at);
CREATE INDEX IF NOT EXISTS idx_phone_otps_phone_active ON phone_otps(phone, is_used, expires_at) WHERE is_used = FALSE;

-- Add comment
COMMENT ON TABLE phone_otps IS 'Temporary storage for phone OTP codes sent via Authentica SMS';

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
--
-- This table was originally created WITHOUT RLS. In Supabase, a public-schema
-- table with RLS disabled is readable by anyone holding the anon key — which is
-- published in the web bundle and the mobile binary. That exposed live phone
-- numbers and OTP codes.
--
-- Deny-all is the correct policy: every access is server-side through
-- createServerClient() (service role), and the service role bypasses RLS. No
-- client should ever read or write this table directly, now or in future.
-- Enabling RLS with no policy therefore changes no application behaviour and
-- closes the exposure permanently.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE phone_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_otps FORCE ROW LEVEL SECURITY;

-- No CREATE POLICY by design: with RLS enabled and no policy, every non-service
-- role is denied. Adding a policy here would be a mistake, not an omission.

REVOKE ALL ON phone_otps FROM anon, authenticated;

