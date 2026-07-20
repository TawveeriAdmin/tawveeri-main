-- e3_rls_remediation.sql
-- Application database (ffpsjjazsluolysgithg) — E3 RLS remediation
--
-- WHAT THIS FIXES
--   Five objects are readable with the PUBLIC anon key, which ships in the web
--   bundle and the mobile app binary:
--
--     phone_otps            94 rows — phone numbers and OTP codes
--     login_sessions        12 rows — user ids, device fingerprints, user agents, IPs
--     mv_user_analytics      2 rows — user ids with activity counts
--     mv_store_analytics     5 rows
--     mv_product_analytics   7 rows
--
--   phone_otps and login_sessions were created without RLS (migrations 08 and
--   12). The materialized views cannot carry RLS at all and were left at
--   Supabase's default grant, which includes anon.
--
-- WHY IT IS SAFE
--   Every application read of these objects is server-side through the service
--   role, which bypasses RLS and is unaffected by these grants:
--     phone_otps      — send-phone-otp, verify-phone-otp, send-email-otp,
--                       reset-password-phone (all createServerClient)
--     login_sessions  — check-device (createServerClient)
--     mv_*            — admin and store dashboards, now marked server-only
--
--   No client-side code reads any of them. Verified by import analysis: the
--   only consumers are server components.
--
-- APPLY THIS EVEN THOUGH THIS DATABASE IS BEING RETIRED. Retirement depends on
-- E10, E11, E12 and E14; the exposure is live now.
--
-- ROLLBACK: see the block at the end of this file.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. phone_otps — deny all non-service access
-- ─────────────────────────────────────────────────────────────
ALTER TABLE phone_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_otps FORCE ROW LEVEL SECURITY;

-- No policy by design: RLS enabled with no policy denies every non-service role.
REVOKE ALL ON phone_otps FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. login_sessions — own-row read for signed-in users, nothing else
-- ─────────────────────────────────────────────────────────────
ALTER TABLE login_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own login sessions" ON login_sessions;
CREATE POLICY "Users can view their own login sessions"
  ON login_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON login_sessions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON login_sessions FROM authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Analytics materialized views — grants are the only control available
-- ─────────────────────────────────────────────────────────────
REVOKE ALL ON mv_user_analytics    FROM anon, authenticated;
REVOKE ALL ON mv_product_analytics FROM anon, authenticated;
REVOKE ALL ON mv_store_analytics   FROM anon, authenticated;

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- 4. VERIFY — run as a separate statement and read the output.
--    rls_enabled must be true for both tables; anon_can_select must be false
--    for all five objects.
-- ─────────────────────────────────────────────────────────────
SELECT
  c.relname                                   AS object_name,
  c.relrowsecurity                            AS rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT') AS anon_can_select,
  has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_can_select
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('phone_otps','login_sessions',
                    'mv_user_analytics','mv_product_analytics','mv_store_analytics')
ORDER BY c.relname;

-- ─────────────────────────────────────────────────────────────
-- ROLLBACK (only if a dashboard or auth flow breaks — it should not)
-- ─────────────────────────────────────────────────────────────
-- BEGIN;
--   ALTER TABLE phone_otps     NO FORCE ROW LEVEL SECURITY;
--   ALTER TABLE phone_otps     DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE login_sessions DISABLE ROW LEVEL SECURITY;
--   DROP POLICY IF EXISTS "Users can view their own login sessions" ON login_sessions;
--   GRANT SELECT ON phone_otps, login_sessions TO anon, authenticated;
--   GRANT SELECT ON mv_user_analytics, mv_product_analytics, mv_store_analytics
--     TO anon, authenticated;
-- COMMIT;
--
-- Rolling back restores the exposure. Prefer diagnosing the broken caller: any
-- code that breaks was reading these objects with anon privileges, which is the
-- defect being fixed.
