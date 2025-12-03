/**
 * Phone validation and formatting utilities for Saudi phone numbers
 */

export interface PhoneValidationResult {
  isValid: boolean;
  formatted?: string;
  error?: string;
}

/**
 * Validates and formats Saudi phone number
 * Accepts: 0501234567, +966501234567, 966501234567
 * Returns: +966501234567
 */
export function validateSaudiPhone(phone: string): PhoneValidationResult {
  if (!phone) {
    return { isValid: false, error: 'Phone number is required' };
  }

  // Remove any spaces, dashes, or other characters
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // Check if already in international format (+9665XXXXXXXX)
  if (cleaned.startsWith('+966') && cleaned.length === 13) {
    const digits = cleaned.substring(4);
    if (/^5[0-9]{8}$/.test(digits)) {
      return { isValid: true, formatted: cleaned };
    }
  }

  // Check if starts with 966 (without +)
  if (cleaned.startsWith('966') && cleaned.length === 12) {
    const digits = cleaned.substring(3);
    if (/^5[0-9]{8}$/.test(digits)) {
      return { isValid: true, formatted: `+${cleaned}` };
    }
  }

  // Check if starts with 05 (Saudi local format)
  if (cleaned.startsWith('05') && cleaned.length === 10) {
    const digits = cleaned.substring(2);
    if (/^[0-9]{8}$/.test(digits)) {
      return { isValid: true, formatted: `+966${cleaned.substring(1)}` };
    }
  }

  // Check if starts with 5 (9 digits)
  if (cleaned.startsWith('5') && cleaned.length === 9) {
    if (/^5[0-9]{8}$/.test(cleaned)) {
      return { isValid: true, formatted: `+966${cleaned}` };
    }
  }

  return {
    isValid: false,
    error: 'Invalid Saudi phone number format. Use: 0501234567 or +966501234567',
  };
}

/**
 * Generates a 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

