import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { authenticaService } from '@/lib/auth/authentica';
import { validateSaudiPhone, generateOTP } from '@/lib/auth/phone-validation';

// Ensure this is a route handler
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Explicitly load .env.local to ensure variables are available
if (typeof process !== 'undefined') {
  try {
    const dotenv = require('dotenv');
    const path = require('path');
    const result = dotenv.config({ path: path.join(process.cwd(), '.env.local') });
    if (result.error) {
      console.warn('dotenv config error:', result.error);
    } else {
      console.log('dotenv loaded, AUTHENTICA_API_KEY exists:', !!result.parsed?.AUTHENTICA_API_KEY);
    }
  } catch (error) {
    // dotenv might not be available, that's okay
    console.warn('Could not load dotenv:', error);
  }
}

// Debug: Log environment variables at module load
if (typeof process !== 'undefined') {
  const apiKey = process.env.AUTHENTICA_API_KEY;
  const baseUrl = process.env.AUTHENTICA_BASE_URL;
  console.log('API Route - Environment check:', {
    hasAuthenticaKey: !!apiKey,
    hasAuthenticaUrl: !!baseUrl,
    keyLength: apiKey?.length || 0,
    keyPrefix: apiKey?.substring(0, 10) || 'N/A',
    keyValue: apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}` : 'N/A',
    baseUrlValue: baseUrl || 'N/A',
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('AUTHENTICA')),
    // Try to read directly from process.env
    directRead: typeof process.env.AUTHENTICA_API_KEY,
  });
}

export async function POST(request: NextRequest) {
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
      console.error('Error storing OTP:', insertError);
      return NextResponse.json(
        { error: 'Failed to store OTP' },
        { status: 500 }
      );
    }

    // Send OTP via Authentica
    const smsResult = await authenticaService.sendOTP(formattedPhone, otpCode);

    if (!smsResult.success) {
      console.error('Failed to send OTP via Authentica:', smsResult.error);
      return NextResponse.json(
        { error: smsResult.error || 'Failed to send OTP. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
      messageId: smsResult.messageId,
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

