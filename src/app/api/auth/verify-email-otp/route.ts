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

    // Find active OTP for this email
    const { data: otpRecord, error: otpError } = await supabase
      .from('phone_otps')
      .select('*')
      .eq('phone', email)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpRecord) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    if (otpRecord.otp_code !== otp) {
      // Increment attempts
      await supabase
        .from('phone_otps')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('id', otpRecord.id);

      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Mark OTP as used
    await supabase
      .from('phone_otps')
      .update({
        is_used: true,
        verified_at: new Date().toISOString(),
      })
      .eq('id', otpRecord.id);

    // Update email_verified in users table
    const { data: userRecord } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userRecord) {
      await supabase
        .from('users')
        .update({ email_verified: true })
        .eq('id', userRecord.id);

      // Update Supabase Auth email_confirmed_at
      await supabase.auth.admin.updateUserById(userRecord.id, {
        email_confirm: true,
      });

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
