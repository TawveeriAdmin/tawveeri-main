import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createAuditLog } from '@/lib/auth/audit';
import { createNotification, sendWelcomeEmail, sendNewDeviceLoginEmail } from '@/lib/auth/notifications';
import { createServerClient as createAdminClient } from '@/lib/database';
import { createHash } from 'crypto';

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

        // Send welcome email (fire-and-forget)
        if (user.email) {
          const fullName = user.user_metadata.full_name || user.user_metadata.name;
          sendWelcomeEmail(user.email, fullName, 'ar').catch((err) =>
            console.error('Failed to send welcome email:', err)
          );
        }

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

      // Check for new device (OAuth login)
      try {
        const adminSupabase = createAdminClient();
        const userAgent = request.headers.get('user-agent') || 'unknown';
        const forwarded = request.headers.get('x-forwarded-for');
        const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '0.0.0.0';
        const ipParts = ip.split('.').slice(0, 3).join('.');
        const fingerprint = createHash('sha256').update(`${userAgent}:${ipParts}`).digest('hex');

        const { data: existingSession } = await adminSupabase
          .from('login_sessions')
          .select('id')
          .eq('user_id', user.id)
          .eq('device_fingerprint', fingerprint)
          .maybeSingle();

        if (!existingSession) {
          await adminSupabase.from('login_sessions').insert({
            user_id: user.id,
            device_fingerprint: fingerprint,
            user_agent: userAgent,
            ip_address: ip,
            is_known_device: true,
          });

          const deviceInfo = userAgent.includes('iPhone') ? 'iPhone'
            : userAgent.includes('Android') ? 'Android'
            : userAgent.includes('Windows') ? 'Windows PC'
            : userAgent.includes('Macintosh') ? 'Mac'
            : 'Unknown Device';

          createNotification({
            user_id: user.id,
            type: 'system',
            title_ar: 'تسجيل دخول من جهاز جديد',
            title_en: 'Login from New Device',
            message_ar: `تم تسجيل دخول إلى حسابك من جهاز جديد: ${deviceInfo}`,
            message_en: `Your account was accessed from a new device: ${deviceInfo}`,
          }).catch(() => {});

          if (user.email) {
            sendNewDeviceLoginEmail(
              user.email,
              { device_info: deviceInfo, login_time: new Date().toLocaleString('en-US') },
            ).catch(() => {});
          }

          createAuditLog({
            user_id: user.id,
            action: 'new_device_login',
            entity_type: 'user',
            entity_id: user.id,
            details: { device_info: deviceInfo, ip_address: ip },
            user_agent: userAgent,
            ip_address: ip,
          }).catch(() => {});
        } else {
          await adminSupabase
            .from('login_sessions')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', existingSession.id);
        }
      } catch (err) {
        console.error('Device check error in OAuth callback:', err);
      }

      // Redirect to dashboard or specified page
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // If there was an error or no code, redirect to login
  return NextResponse.redirect(new URL('/auth/login?error=auth_failed', request.url));
}
