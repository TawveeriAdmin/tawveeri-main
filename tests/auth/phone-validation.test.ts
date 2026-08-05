/**
 * Regression tests for Saudi phone number validation + OTP generation.
 * Pure functions — no database, part of the default fast test gate.
 *
 * Added 2026-08-05 alongside the OTP production incident fix: the incident itself was
 * a missing database table, not a validation bug, but every format this function
 * accepts is exactly what a real user could submit through the OTP request UI, so it
 * is the right place to lock down "does every accepted Saudi format normalize the same
 * way" going forward.
 */
import { validateSaudiPhone, generateOTP } from '@/lib/auth/phone-validation';

describe('validateSaudiPhone', () => {
  const validFormats: Array<[string, string]> = [
    ['0501234567', '+966501234567'],
    ['+966501234567', '+966501234567'],
    ['966501234567', '+966501234567'],
    ['501234567', '+966501234567'],
    ['050 123 4567', '+966501234567'],
    ['050-123-4567', '+966501234567'],
  ];

  it.each(validFormats)('normalizes %s to %s', (input, expected) => {
    const result = validateSaudiPhone(input);
    expect(result.isValid).toBe(true);
    expect(result.formatted).toBe(expected);
  });

  const invalidFormats = [
    '',
    '123456789',        // doesn't start with 5 after the prefix
    '05012345',         // too short
    '05012345678',      // too long
    '+9665012345',      // too short international
    '+96650123456789',  // too long international
    'not-a-phone',
  ];

  it.each(invalidFormats)('rejects %s', (input) => {
    const result = validateSaudiPhone(input);
    expect(result.isValid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects a null/undefined-equivalent empty string with a clear error', () => {
    const result = validateSaudiPhone('');
    expect(result).toEqual({ isValid: false, error: 'Phone number is required' });
  });
});

describe('generateOTP', () => {
  it('always returns a 6-digit numeric string', () => {
    for (let i = 0; i < 50; i++) {
      const otp = generateOTP();
      expect(otp).toMatch(/^[0-9]{6}$/);
      expect(Number(otp)).toBeGreaterThanOrEqual(100000);
      expect(Number(otp)).toBeLessThanOrEqual(999999);
    }
  });
});
