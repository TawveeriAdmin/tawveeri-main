import { consumeOtp } from '@/lib/auth/consume-otp';
import { getRequestUser } from '@/lib/auth/api-auth';
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

    // Update phone_verified in users table
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const { data: userRecord, error: profileError } = await supabase
      .from('users').select('id').eq('id', user.id).eq('phone', formattedPhone).maybeSingle();
    if (profileError) return NextResponse.json({ error: 'Verification unavailable' }, { status: 503 });
    if (!userRecord || !(await consumeOtp(supabase, formattedPhone, otp, 'phone_verify', user.id))) {
      return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 400 });
    }

    if (userRecord) {
      const { error: authError } = await supabase.auth.admin.updateUserById(userRecord.id, {
        phone: formattedPhone,
        phone_confirm: true,
      });
      if (authError) return NextResponse.json({ error: 'Phone verification could not be saved' }, { status: 503 });
      const { error: saveError } = await supabase
        .from('users')
        .update({ phone_verified: true })
        .eq('id', userRecord.id);

      if (saveError) return NextResponse.json({ error: 'Phone verification could not be saved' }, { status: 503 });

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
