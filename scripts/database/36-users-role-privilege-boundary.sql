-- 36-users-role-privilege-boundary.sql — P0 privilege escalation (ADR-259, 2026-08-18)
--
-- THE DEFECT (measured, 2026-08-18 readiness audit)
-- `users_update_self` is an UPDATE policy with USING (id = auth.uid() OR is_admin())
-- and no WITH CHECK, and BOTH `anon` and `authenticated` held an UPDATE grant on EVERY
-- column of public.users — including `role`. public.users is exposed through PostgREST
-- (a GET with the public anon key returns 200), and the application resolves admin
-- status from that same column (src/lib/auth/api-auth.ts, src/lib/auth/server.ts), with
-- is_admin() — SECURITY DEFINER — reading it for every role-gated RLS policy.
--
-- Chain: sign up -> PATCH /rest/v1/users?id=eq.<self> {"role":"admin"} -> full /admin/*,
-- /api/admin/*, and every is_admin() policy, including users_admin_delete. Signup is open.
-- The exploit was NOT executed against production; the chain was verified from
-- pg_policies, information_schema.column_privileges, pg_trigger and a live REST probe.
--
-- THE FIX — two independent barriers, per Supabase's Column Level Security guidance
-- (https://supabase.com/docs/guides/database/postgres/column-level-security), which
-- names exactly this case: RLS chooses ROWS, column privileges choose COLUMNS, and a
-- row-level policy alone cannot stop a client writing a column it should never touch.
--
--   1. COLUMN PRIVILEGES (the boundary). Revoke table-wide UPDATE from the client roles
--      and grant back only the columns a user legitimately edits about themselves.
--   2. A TRIGGER (the ratchet). Column grants are the kind of thing a later migration
--      re-opens by accident — `GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated`
--      is one line and silently restores the hole. The trigger keeps `role` immutable to
--      every caller except service_role/superuser regardless of what the grants say.
--
-- We deliberately did NOT move roles to a separate user_roles table. That is Supabase's
-- general recommendation and it is right for a greenfield schema, but here it would
-- rewrite every authorization read path (middleware, server.ts, api-auth.ts, is_admin(),
-- twelve RLS policies) to close a hole that these two barriers close completely. Smallest
-- correct fix, per mission constraint.
--
-- WHAT STAYS WORKING
--   - profile edits: full_name, preferred_language (profile page), avatar_url, email,
--     phone (src/lib/auth/profile.ts, browser client), last_login_at (auth-context.tsx).
--   - email_verified / phone_verified / role writes already run through the SERVICE-ROLE
--     client (verify-email-otp, verify-profile-phone-otp, verify-phone-otp) — unaffected.
--   - admin role changes: /api/admin/users/[id]/role moves to the service-role client in
--     the same commit. It previously wrote as `authenticated` and leaned on
--     `OR is_admin()` in the policy; assigning a role is a privileged server operation
--     and now runs as one.
--
-- ROLLBACK / RECOVERY
--   Forward-safe and idempotent. To revert (do not, without replacing the protection):
--     DROP TRIGGER trg_users_role_immutable ON public.users;
--     DROP FUNCTION public.enforce_user_role_immutable();
--     GRANT UPDATE ON public.users TO authenticated, anon;
--   No data is read, written, or deleted by this migration. Zero rows change.
--   Admin access is preserved: existing admin rows are untouched, and the bootstrap
--   ADMIN_EMAILS path never depended on users.role at all.

-- ── Barrier 1: column privileges ────────────────────────────────────────────────────
-- Table-wide UPDATE goes away for both client roles; SELECT/INSERT/DELETE are left as
-- they are (RLS already gates them correctly and INSERT is pinned by users_insert_self).
REVOKE UPDATE ON public.users FROM authenticated;
REVOKE UPDATE ON public.users FROM anon;

-- An unauthenticated caller has no row of their own (every policy keys on auth.uid()),
-- so `anon` is granted nothing back.
GRANT UPDATE (full_name, avatar_url, preferred_language, phone, email, last_login_at, updated_at)
  ON public.users TO authenticated;

-- NOT granted, deliberately — each was client-writable before this migration:
--   role               -> the P0: self-promotion to admin
--   is_active          -> a suspended account could re-activate itself
--   email_verified     -> a user could mark their own email verified without an OTP
--   phone_verified     -> same, for phone
--   id                 -> row identity must never move
--   created_at         -> audit integrity
--   auth_provider, auth_provider_id -> identity provenance

-- ── Barrier 2: the ratchet ──────────────────────────────────────────────────────────
-- SECURITY INVOKER — deliberately, and this is the whole correctness of the barrier.
-- Written first as SECURITY DEFINER, it silently failed open: inside a SECURITY DEFINER
-- function `current_user` is the function's OWNER (postgres), not the caller, so the
-- "is this a privileged caller?" test was true for everybody. Caught by the regression
-- probe below, which re-granted UPDATE and confirmed the trigger still refused. As
-- INVOKER, `current_user` is what PostgREST actually SET ROLE'd to — `authenticated`,
-- `anon`, or `service_role` — which is the signal we need.
CREATE OR REPLACE FUNCTION public.enforce_user_role_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  -- PostgREST publishes the verified JWT claims here. A `service_role` key produces
  -- role='service_role'; an end user's token produces 'authenticated'. The claim is set
  -- by PostgREST after signature verification, so it cannot be forged by the client.
  BEGIN
    jwt_role := coalesce(
      current_setting('request.jwt.claim.role', true),
      (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role')
    );
  EXCEPTION WHEN others THEN
    jwt_role := NULL;   -- malformed/absent claims are never treated as authorization
  END;

  -- Allowed writers: the service-role API path, and direct maintenance connections
  -- (migrations, psql), which are already trusted with the whole database.
  IF jwt_role = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'users.role is not client-writable (attempted % -> %)', OLD.role, NEW.role
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_users_role_immutable ON public.users;
CREATE TRIGGER trg_users_role_immutable
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_role_immutable();

-- ── Barrier 3: make the policy state its own intent ─────────────────────────────────
-- USING chooses which existing rows may be updated; without WITH CHECK, Postgres reuses
-- USING for the post-image, which is why "the row is still mine" was the only test the
-- old policy applied. Stating WITH CHECK explicitly means the policy no longer reads as
-- if it permitted arbitrary column writes.
DROP POLICY IF EXISTS users_update_self ON public.users;
CREATE POLICY users_update_self ON public.users
  FOR UPDATE
  USING (id = auth.uid() OR is_admin())
  WITH CHECK (id = auth.uid() OR is_admin());
