import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { validateSaudiPhone } from '@/lib/auth/phone-validation';
import { createNotification } from '@/lib/auth/notifications';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/auth/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { phone, otp, newPassword } = body;

    if (!phone || !otp || !newPassword) {
      return NextResponse.json(
        { error: 'Phone, OTP, and new password are required' },
        { status: 400 },
      );
    }

    // Validate phone
    const phoneValidation = validateSaudiPhone(phone);
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { error: phoneValidation.error || 'Invalid phone number' },
        { status: 400 },
      );
    }
    const formattedPhone = phoneValidation.formatted!;

    // Validate password
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    // Validate OTP format
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: 'OTP must be 6 digits' },
        { status: 400 },
      );
    }

    const supabase = createServerClient();

    // Verify OTP from database
    const { data: otpRecord, error: otpError } = await supabase
      .from('phone_otps')
      .select('id, otp_code')
      .eq('phone', formattedPhone)
      .eq('otp_code', otp)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .returns<{ id: string; otp_code: string }>();

    if (otpError || !otpRecord) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP. Please request a new code.' },
        { status: 400 },
      );
    }

    // Mark OTP as used
    await supabase
      .from('phone_otps')
      .update({ is_used: true })
      .eq('id', otpRecord.id);

    // Find user by phone number
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, email')
      .eq('phone', formattedPhone)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: 'No account found with this phone number' },
        { status: 404 },
      );
    }

    // Update password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userProfile.id,
      { password: newPassword },
    );

    if (updateError) {
      console.error('Password update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update password. Please try again.' },
        { status: 500 },
      );
    }

    // Create notification
    await createNotification({
      user_id: userProfile.id,
      type: 'account',
      title_ar: 'تم تغيير كلمة المرور',
      title_en: 'Password Changed',
      message_ar: 'تم إعادة تعيين كلمة المرور بنجاح عبر رقم الجوال.',
      message_en: 'Your password has been successfully reset via phone number.',
    });

    // Create audit log
    await createAuditLog({
      user_id: userProfile.id,
      action: AUDIT_ACTIONS.PASSWORD_CHANGED,
      entity_type: 'user',
      entity_id: userProfile.id,
      details: {
        method: 'phone_otp',
        phone: formattedPhone.replace(/\d(?=\d{4})/g, '*'),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    console.error('Reset password phone error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
