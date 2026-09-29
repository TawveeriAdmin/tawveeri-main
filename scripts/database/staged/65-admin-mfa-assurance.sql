-- F-008: STAGED ONLY. Apply only after the owner verifies TOTP and recovery access,
-- and the web/API ADMIN_MFA_REQUIRED gate has been enabled and checked.
-- Never apply this file automatically with unrelated migrations.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(auth.jwt()->>'aal', '') = 'aal2'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$$;

-- Retain the enum and ordinary customer/store behavior. An AAL1 administrator
-- must not obtain administrative authority through the alternate role helper.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE WHEN role = 'admin' AND coalesce(auth.jwt()->>'aal', '') <> 'aal2'
    THEN NULL::public.user_role ELSE role END
  FROM public.users WHERE id = auth.uid();
$$;
COMMIT;
