-- F-016. Additive schema first; deploy all OTP issuers/consumers together next.
-- Legacy codes intentionally require reissuance after application deployment.
-- Safe rollback: retain the atomic consumer and purpose checks; never restore
-- SELECT-then-unconditional-UPDATE authentication or accept legacy codes.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';

ALTER TABLE public.phone_otps ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.phone_otps ADD COLUMN IF NOT EXISTS account_id uuid;

CREATE OR REPLACE FUNCTION public.consume_phone_otp(
  p_phone text, p_otp text, p_purpose text,
  p_account_id uuid DEFAULT NULL, p_consume boolean DEFAULT true
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE candidate public.phone_otps%ROWTYPE;
BEGIN
  IF p_purpose NOT IN ('phone_signin', 'password_reset', 'phone_verify', 'email_verify')
     OR p_purpose IS NULL OR p_otp IS NULL OR p_otp !~ '^[0-9]{6}$' THEN
    RETURN false;
  END IF;
  IF p_purpose <> 'phone_signin' AND p_account_id IS NULL THEN RETURN false; END IF;

  -- Lock the latest challenge, including already-used rows. Never fall back to
  -- an older challenge when the latest one was consumed or exhausted.
  SELECT * INTO candidate FROM public.phone_otps
    WHERE phone = p_phone AND purpose = p_purpose
      AND account_id IS NOT DISTINCT FROM p_account_id
    ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR candidate.is_used OR candidate.expires_at <= clock_timestamp()
     OR candidate.attempts >= 5 THEN RETURN false; END IF;

  IF candidate.otp_code IS DISTINCT FROM p_otp THEN
    UPDATE public.phone_otps SET attempts = attempts + 1 WHERE id = candidate.id;
    RETURN false;
  END IF;
  IF p_consume THEN
    UPDATE public.phone_otps SET is_used = true, verified_at = clock_timestamp()
      WHERE id = candidate.id;
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_phone_otp(text, text, text, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_phone_otp(text, text, text, uuid, boolean) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
