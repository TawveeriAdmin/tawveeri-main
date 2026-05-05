import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createAuditLog } from '@/lib/auth/audit';
import { createNotification } from '@/lib/auth/notifications';

/**
 * Email Verification Route
 * Handles email verification confirmation
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  if (token_hash && type === 'email') {
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

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: 'email',
    });

    if (!error && data.session) {
      const user = data.session.user;

      // Create notification for verified email
      await createNotification({
        user_id: user.id,
        type: 'system',
        title_ar: 'تم التحقق من البريد الإلكتروني',
        title_en: 'Email Verified',
        message_ar: 'تم التحقق من بريدك الإلكتروني بنجاح',
        message_en: 'Your email has been verified successfully',
      });

      // Audit log
      await createAuditLog({
        user_id: user.id,
        action: 'email_verified',
        entity_type: 'user',
        entity_id: user.id,
      });

      // Redirect to dashboard
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // If verification failed, redirect to login with error
  return NextResponse.redirect(
    new URL('/auth/login?error=verification_failed', request.url)
  );
}
