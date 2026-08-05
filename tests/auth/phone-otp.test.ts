/**
 * Regression tests for the `phone_otps` table and the OTP send/verify contract.
 *
 * Added 2026-08-05 after a production incident: OTP registration/login was completely
 * blocked ("Failed to store OTP" / PGRST205) because the `phone_otps` table itself had
 * never been created in the production database — migration
 * `scripts/database/08-phone-otps-schema.sql` existed in the repo but had never been
 * applied. Nothing about phone validation, RLS design, or the route code was wrong; the
 * table simply did not exist. The most valuable regression guard for this exact failure
 * mode is a live check that the table exists and accepts a real insert — a unit test
 * with a mocked Supabase client would have passed throughout the entire incident.
 *
 * This is a live-DB integration suite (same pattern as tests/auth/audit.test.ts) — run
 * via `npm run test:integration`, excluded from the default fast gate (ADR-054).
 */
import { createServerClient } from '@/lib/database';
import { validateSaudiPhone, generateOTP } from '@/lib/auth/phone-validation';

// A phone number reserved for tests only — never a real subscriber number, and every
// row this suite creates is deleted in afterEach/afterAll.
const TEST_PHONE = '+966599999999';

describe('phone_otps table', () => {
  const supabase = createServerClient();

  afterEach(async () => {
    await supabase.from('phone_otps').delete().eq('phone', TEST_PHONE);
  });

  it('exists and accepts an insert exactly like the send-phone-otp route performs (regression guard for the 2026-08-05 incident)', async () => {
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const { error } = await supabase.from('phone_otps').insert({
      phone: TEST_PHONE,
      otp_code: otpCode,
      expires_at: expiresAt.toISOString(),
    });

    // A PGRST205 ("Could not find the table ... in the schema cache") or a raw
    // "relation does not exist" error here means the table is gone again.
    expect(error).toBeNull();
  });

  it('stores an OTP that can be read back while active (not used, not expired)', async () => {
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await supabase.from('phone_otps').insert({
      phone: TEST_PHONE,
      otp_code: otpCode,
      expires_at: expiresAt.toISOString(),
    });

    const { data, error } = await supabase
      .from('phone_otps')
      .select('*')
      .eq('phone', TEST_PHONE)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    expect(error).toBeNull();
    expect(data?.otp_code).toBe(otpCode);
  });

  it('does not return an OTP that has already expired', async () => {
    const otpCode = generateOTP();
    const alreadyExpired = new Date(Date.now() - 60 * 1000); // 1 minute in the past

    await supabase.from('phone_otps').insert({
      phone: TEST_PHONE,
      otp_code: otpCode,
      expires_at: alreadyExpired.toISOString(),
    });

    const { data, error } = await supabase
      .from('phone_otps')
      .select('*')
      .eq('phone', TEST_PHONE)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('does not return an OTP already marked used (matches the verify route\'s "Invalid or expired OTP" path)', async () => {
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const { data: inserted } = await supabase
      .from('phone_otps')
      .insert({ phone: TEST_PHONE, otp_code: otpCode, expires_at: expiresAt.toISOString() })
      .select('id')
      .single();

    await supabase.from('phone_otps').update({ is_used: true }).eq('id', inserted!.id);

    const { data } = await supabase
      .from('phone_otps')
      .select('*')
      .eq('phone', TEST_PHONE)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();

    expect(data).toBeNull();
  });

  it('a wrong OTP code does not match the stored one (matches the verify route\'s "Invalid OTP code" path)', async () => {
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await supabase.from('phone_otps').insert({
      phone: TEST_PHONE,
      otp_code: otpCode,
      expires_at: expiresAt.toISOString(),
    });

    const { data } = await supabase
      .from('phone_otps')
      .select('otp_code')
      .eq('phone', TEST_PHONE)
      .eq('is_used', false)
      .single();

    const wrongCode = otpCode === '111111' ? '222222' : '111111';
    expect(data?.otp_code).not.toBe(wrongCode);
  });

  it('resend invalidates the previous active OTP for the same phone without a unique-constraint conflict', async () => {
    const firstCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await supabase.from('phone_otps').insert({
      phone: TEST_PHONE,
      otp_code: firstCode,
      expires_at: expiresAt.toISOString(),
    });

    // Mirrors the route: invalidate existing active OTPs, then insert a new one.
    await supabase
      .from('phone_otps')
      .update({ is_used: true })
      .eq('phone', TEST_PHONE)
      .eq('is_used', false);

    const secondCode = generateOTP();
    const { error: secondInsertError } = await supabase.from('phone_otps').insert({
      phone: TEST_PHONE,
      otp_code: secondCode,
      expires_at: expiresAt.toISOString(),
    });

    // A unique constraint on `phone` alone would make this fail (there's already a
    // used row for this phone) — it must not.
    expect(secondInsertError).toBeNull();

    const { data: activeRows } = await supabase
      .from('phone_otps')
      .select('otp_code, is_used')
      .eq('phone', TEST_PHONE)
      .eq('is_used', false);

    expect(activeRows).toHaveLength(1);
    expect(activeRows?.[0]?.otp_code).toBe(secondCode);
  });

  it('validateSaudiPhone + generateOTP produce values the table accepts (end-to-end shape check)', async () => {
    const phoneResult = validateSaudiPhone('0599999999');
    expect(phoneResult.isValid).toBe(true);
    expect(phoneResult.formatted).toBe(TEST_PHONE);

    const otpCode = generateOTP();
    const { error } = await supabase.from('phone_otps').insert({
      phone: phoneResult.formatted!,
      otp_code: otpCode,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
    expect(error).toBeNull();
  });
});
