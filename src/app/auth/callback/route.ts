import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createAuditLog } from '@/lib/auth/audit';
import { createNotification } from '@/lib/auth/notifications';

/**
 * Auth Callback Route
 * Handles OAuth callback and email verification
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            request.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: any) {
            request.cookies.set({
              name,
              value: '',
              ...options,
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const user = data.session.user;

      // Check if this is a new user (OAuth signup)
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single();

      // Create user profile if new OAuth user
      if (!existingUser) {
        const provider = user.app_metadata.provider || 'google';

        await supabase.from('users').insert({
          id: user.id,
          email: user.email || null,
          full_name: user.user_metadata.full_name || user.user_metadata.name || null,
          avatar_url: user.user_metadata.avatar_url || null,
          preferred_language: 'ar',
          role: 'customer',
          auth_provider: provider,
        });

        // Welcome notification for new OAuth user
        await createNotification({
          user_id: user.id,
          type: 'system',
          title_ar: 'مرحباً بك في توفيري',
          title_en: 'Welcome to Tawveeri',
          message_ar: 'نحن سعداء بانضمامك إلينا',
          message_en: 'We are happy to have you join us',
        });

        // Audit log for OAuth signup
        await createAuditLog({
          user_id: user.id,
          action: 'user_signup',
          entity_type: 'user',
          entity_id: user.id,
          details: {
            method: 'oauth',
            provider,
          },
        });
      } else {
        // Update last login for existing user
        await supabase
          .from('users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', user.id);

        // Audit log for OAuth login
        await createAuditLog({
          user_id: user.id,
          action: 'user_login',
          entity_type: 'user',
          entity_id: user.id,
          details: {
            method: 'oauth',
            provider: user.app_metadata.provider,
          },
        });
      }

      // Redirect to dashboard or specified page
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // If there was an error or no code, redirect to login
  return NextResponse.redirect(new URL('/auth/login?error=auth_failed', request.url));
}
