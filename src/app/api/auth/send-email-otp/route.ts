import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { generateOTP } from '@/lib/auth/phone-validation';
import { sendEmailNotification } from '@/lib/auth/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Invalidate any existing active OTPs for this email
    await supabase
      .from('phone_otps')
      .update({ is_used: true })
      .eq('phone', email)
      .eq('is_used', false);

    // Generate OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP (reusing phone_otps table with email as identifier)
    const { error: insertError } = await supabase
      .from('phone_otps')
      .insert({
        phone: email,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error storing email OTP:', insertError);
      return NextResponse.json(
        { error: 'Failed to generate verification code' },
        { status: 500 }
      );
    }

    // Send OTP via SendGrid
    const { error: emailError } = await sendEmailNotification({
      to: email,
      subject_ar: 'رمز التحقق من البريد الإلكتروني - توفيري',
      subject_en: 'Email Verification Code - Tawveeri',
      template: 'email_verification',
      data: { otp_code: otpCode },
    });

    if (emailError) {
      console.error('Failed to send email OTP:', emailError);
      return NextResponse.json(
        { error: 'Failed to send verification email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to email',
    });
  } catch (error) {
    console.error('Send email OTP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
