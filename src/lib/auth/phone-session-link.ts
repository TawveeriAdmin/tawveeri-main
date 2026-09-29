import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database/types';

/** Mint only for the Auth identity owning the consumed phone challenge. */
export async function generateBoundPhoneLink(client: SupabaseClient<Database>, userId: string, phone: string) {
  const { data, error } = await client.auth.admin.getUserById(userId);
  const user = data?.user;
  if (error || !user || user.id !== userId || user.phone?.replace(/\D/g, '') !== phone.replace(/\D/g, '')) {
    throw new Error('Phone account could not be verified');
  }
  let email = user.email;
  if (!email) {
    email = `phone_${phone.replace(/\D/g, '')}@tawveeri.local`;
    const { error: updateError } = await client.auth.admin.updateUserById(userId, { email, email_confirm: true });
    if (updateError) throw new Error('Phone session unavailable');
  }
  const { data: link, error: linkError } = await client.auth.admin.generateLink({
    type: 'magiclink', email,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?type=phone` },
  });
  if (linkError || !link || link.user.id !== userId) throw new Error('Phone session identity mismatch');
  return link;
}
