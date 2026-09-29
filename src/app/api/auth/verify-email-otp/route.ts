import { consumeOtp } from '@/lib/auth/consume-otp';
import { getRequestUser } from '@/lib/auth/api-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { createAuditLog } from '@/lib/auth/audit';
import { createNotification } from '@/lib/auth/notifications';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and verification code are required' },
        { status: 400 }
      );
    }

    if (!/^[0-9]{6}$/.test(otp)) {
      return NextResponse.json(
        { error: 'Invalid code format. Must be 6 digits' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Update email_verified in users table
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const { data: userRecord, error: profileError } = await supabase
      .from('users').select('id').eq('id', user.id).eq('email', email).maybeSingle();
    if (profileError) return NextResponse.json({ error: 'Verification unavailable' }, { status: 503 });
    if (!userRecord || !(await consumeOtp(supabase, email, otp, 'email_verify', user.id))) {
      return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 400 });
    }

    if (userRecord) {
      const { error: authError } = await supabase.auth.admin.updateUserById(userRecord.id, {
        email,
        email_confirm: true,
      });
      if (authError) return NextResponse.json({ error: 'Email verification could not be saved' }, { status: 503 });
      const { error: saveError } = await supabase
        .from('users')
        .update({ email_verified: true })
        .eq('id', userRecord.id);

      if (saveError) return NextResponse.json({ error: 'Email verification could not be saved' }, { status: 503 });

      // In-app notification
      await createNotification({
        user_id: userRecord.id,
        type: 'system',
        title_ar: 'تم التحقق من البريد الإلكتروني',
        title_en: 'Email Verified',
        message_ar: 'تم التحقق من بريدك الإلكتروني بنجاح',
        message_en: 'Your email has been verified successfully',
      });

      // Audit log
      await createAuditLog({
        user_id: userRecord.id,
        action: 'email_verified',
        entity_type: 'user',
        entity_id: userRecord.id,
        details: { email },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    console.error('Verify email OTP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
