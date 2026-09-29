import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database/types';

export type OtpPurpose = 'phone_signin' | 'password_reset' | 'phone_verify' | 'email_verify';

/** Server-only caller: accountId must come from a validated session/profile lookup. */
export async function consumeOtp(
  client: SupabaseClient<Database>,
  identifier: string,
  code: string,
  purpose: OtpPurpose,
  accountId: string | null,
  consume = true,
): Promise<boolean> {
  const { data, error } = await client.rpc('consume_phone_otp', {
    p_phone: identifier, p_otp: code, p_purpose: purpose,
    p_account_id: accountId, p_consume: consume,
  });
  if (error) throw new Error('OTP verification unavailable');
  return data === true;
}
