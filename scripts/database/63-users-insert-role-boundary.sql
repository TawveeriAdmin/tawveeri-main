-- F-002: client INSERT must not create a privileged profile. No data rewrite.
-- Apply after reading the live users policies/grants and isolated role tests.
-- The restrictive policy ANDs with every permissive INSERT policy.
-- Safe rollback: leave these boundaries installed; roll application forward/back
-- to a customer-only profile creator. Never restore unrestricted INSERT roles.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';

REVOKE INSERT ON public.users FROM PUBLIC, anon;

DROP POLICY IF EXISTS users_insert_customer_boundary ON public.users;
CREATE POLICY users_insert_customer_boundary ON public.users
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()) AND role::text = 'customer');

CREATE OR REPLACE FUNCTION public.enforce_user_role_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- SQL execution role is trusted; a client-supplied payload/JWT field is not.
  IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
     AND NEW.role::text IS DISTINCT FROM 'customer' THEN
    RAISE EXCEPTION 'A client profile must use the customer role'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_insert_role_boundary ON public.users;
CREATE TRIGGER trg_users_insert_role_boundary
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_role_on_insert();

COMMIT;
