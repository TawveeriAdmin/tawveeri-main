import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { authenticaService } from '@/lib/auth/authentica';
import { validateSaudiPhone, generateOTP } from '@/lib/auth/phone-validation';

// Ensure this is a route handler
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Safe, bilingual, user-facing message for any internal OTP-send failure (DB, SMS
// provider, or unexpected error). Never return the underlying technical error to the
// client (2026-08-05 incident: a raw Postgres/PostgREST error string — and separately
// an SMS-provider config error — were both shown directly to the user). Full detail
// goes to server logs only, phone masked, OTP never logged.
const OTP_SEND_FAILED_MESSAGE =
  'تعذر إرسال رمز التحقق. حاول مرة أخرى. / Failed to send the verification code. Please try again.';

// Redacts a phone number for logs: keeps the country/operator prefix, drops the rest.
// Never log a full phone number (PII) or the raw OTP code.
function maskPhone(phone: string): string {
  return phone.length > 6 ? `${phone.slice(0, 5)}***${phone.slice(-2)}` : '***';
}

export async function POST(request: NextRequest) {
  let formattedPhoneForLogging: string | undefined;
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Validate and format phone number
    const phoneValidation = validateSaudiPhone(phone);
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { error: phoneValidation.error || 'Invalid phone number format' },
        { status: 400 }
      );
    }

    const formattedPhone = phoneValidation.formatted!;
    formattedPhoneForLogging = formattedPhone;

    // Generate OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // Get Supabase client
    let supabase;
    try {
      supabase = createServerClient();
    } catch (clientError) {
      console.error('Failed to create Supabase client:', clientError);
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    // Invalidate any existing active OTPs for this phone
    await supabase
      .from('phone_otps')
      .update({ is_used: true })
      .eq('phone', formattedPhone)
      .eq('is_used', false);

    // Store new OTP in database
    const { error: insertError } = await supabase
      .from('phone_otps')
      .insert({
        phone: formattedPhone,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      // Detailed error stays server-side only; the client never sees the DB error text.
      console.error('Error storing OTP', {
        phone: maskPhone(formattedPhone),
        code: insertError.code,
        message: insertError.message,
      });
      return NextResponse.json(
        { error: OTP_SEND_FAILED_MESSAGE },
        { status: 500 }
      );
    }

    // Send OTP via Authentica
    const smsResult = await authenticaService.sendOTP(formattedPhone, otpCode);

    if (!smsResult.success) {
      // smsResult.error may describe internal config state (e.g. a missing provider
      // key) — log it for engineers, never return it to the client.
      console.error('Failed to send OTP via SMS provider', {
        phone: maskPhone(formattedPhone),
        detail: smsResult.error,
      });
      return NextResponse.json(
        { error: OTP_SEND_FAILED_MESSAGE },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
      messageId: smsResult.messageId,
    });
  } catch (error) {
    console.error('Send OTP error', {
      phone: formattedPhoneForLogging ? maskPhone(formattedPhoneForLogging) : undefined,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: OTP_SEND_FAILED_MESSAGE },
      { status: 500 }
    );
  }
}

