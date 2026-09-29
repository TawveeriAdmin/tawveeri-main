import type { SupabaseClient } from '@supabase/supabase-js';

// Activate only after the sole administrator enrolls and verifies recovery access.
export const adminMfaRequired = () => process.env.ADMIN_MFA_REQUIRED === '1';

export async function assertAdminAssurance(client: SupabaseClient, userId: string, jwt?: string): Promise<void> {
  if (!adminMfaRequired()) return;
  // getClaims verifies the signature/expiry. A decoded cookie or nextLevel is
  // insufficient: an enrolled factor does not prove this session used it.
  const { data, error } = await client.auth.getClaims(jwt);
  if (error || data?.claims.sub !== userId || data.claims.aal !== 'aal2') {
    throw new Error('Admin access required');
  }
}
