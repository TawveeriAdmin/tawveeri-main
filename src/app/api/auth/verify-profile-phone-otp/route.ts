import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { validateSaudiPhone } from '@/lib/auth/phone-validation';
import { createAuditLog } from '@/lib/auth/audit';
import { createNotification } from '@/lib/auth/notifications';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, otp } = body;

    if (!phone || !otp) {
      return NextResponse.json(
        { error: 'Phone number and verification code are required' },
        { status: 400 }
      );
    }

    const phoneValidation = validateSaudiPhone(phone);
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { error: phoneValidation.error || 'Invalid phone number format' },
        { status: 400 }
      );
    }

    const formattedPhone = phoneValidation.formatted!;

    if (!/^[0-9]{6}$/.test(otp)) {
      return NextResponse.json(
        { error: 'Invalid code format. Must be 6 digits' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Find active OTP for this phone
    const { data: otpRecord, error: otpError } = await supabase
      .from('phone_otps')
      .select('*')
      .eq('phone', formattedPhone)
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

    // Update phone_verified in users table
    const { data: userRecord } = await supabase
      .from('users')
      .select('id')
      .eq('phone', formattedPhone)
      .single();

    if (userRecord) {
      await supabase
        .from('users')
        .update({ phone_verified: true })
        .eq('id', userRecord.id);

      // Update Supabase Auth phone_confirmed_at
      await supabase.auth.admin.updateUserById(userRecord.id, {
        phone_confirm: true,
      });

      // In-app notification
      await createNotification({
        user_id: userRecord.id,
        type: 'system',
        title_ar: 'تم التحقق من رقم الهاتف',
        title_en: 'Phone Verified',
        message_ar: 'تم التحقق من رقم هاتفك بنجاح',
        message_en: 'Your phone number has been verified successfully',
      });

      // Audit log
      await createAuditLog({
        user_id: userRecord.id,
        action: 'phone_verified',
        entity_type: 'user',
        entity_id: userRecord.id,
        details: { phone: formattedPhone },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Phone verified successfully',
    });
  } catch (error) {
    console.error('Verify profile phone OTP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
