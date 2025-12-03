import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { validateSaudiPhone } from '@/lib/auth/phone-validation';
import { createAuditLog } from '@/lib/auth/audit';
import { createNotification } from '@/lib/auth/notifications';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, otp, fullName, preferredLanguage } = body;

    // fullName and preferredLanguage are optional (for signup flow)

    if (!phone || !otp) {
      return NextResponse.json(
        { error: 'Phone number and OTP are required' },
        { status: 400 }
      );
    }

    // Validate phone format
    const phoneValidation = validateSaudiPhone(phone);
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { error: phoneValidation.error || 'Invalid phone number format' },
        { status: 400 }
      );
    }

    const formattedPhone = phoneValidation.formatted!;

    // Validate OTP format (6 digits)
    if (!/^[0-9]{6}$/.test(otp)) {
      return NextResponse.json(
        { error: 'Invalid OTP format. Must be 6 digits' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Find active OTP in database
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
        { error: 'Invalid or expired OTP code' },
        { status: 400 }
      );
    }

    // Check if OTP matches
    if (otpRecord.otp_code !== otp) {
      // Increment attempts
      await supabase
        .from('phone_otps')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('id', otpRecord.id);

      return NextResponse.json(
        { error: 'Invalid OTP code' },
        { status: 400 }
      );
    }

    // OTP is valid - we don't need to verify with Authentica since we manage OTPs ourselves
    // Authentica is only used for sending SMS, not for verification

    // Check if user exists in users table BEFORE marking OTP as used
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', formattedPhone)
      .single();

    let userId: string;
    let isNewUser = false;

    // If user doesn't exist and no fullName provided, return isNewUser flag
    // Don't mark OTP as used yet - user needs to provide name first
    if ((userError || !existingUser) && !fullName) {
      return NextResponse.json({
        success: true,
        isNewUser: true,
        message: 'Please provide your name to create an account',
      });
    }

    // Mark OTP as used (only if we're proceeding with user creation/login)
    await supabase
      .from('phone_otps')
      .update({
        is_used: true,
        verified_at: new Date().toISOString(),
      })
      .eq('id', otpRecord.id);

    if (userError || !existingUser) {
      // Create new user in Supabase Auth using Admin API
      const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
        phone: formattedPhone,
        phone_confirmed: true,
        email_confirm: false,
        user_metadata: {
          full_name: fullName || null,
          preferred_language: preferredLanguage || 'ar',
        },
      });

      if (createError || !authUser.user) {
        console.error('Error creating user in Supabase Auth:', createError);
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        );
      }

      userId = authUser.user.id;
      isNewUser = true;

      // Create user profile in users table
      const { error: profileError } = await supabase.from('users').insert({
        id: userId,
        phone: formattedPhone,
        full_name: fullName || null,
        preferred_language: preferredLanguage || 'ar',
        role: 'customer',
        auth_provider: 'phone',
        phone_verified: true,
        email_verified: false,
      });

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        // User is created in auth but not in users table - this is a problem
        // But we'll continue to avoid blocking the user
      }

      // Create welcome notification
      await createNotification({
        user_id: userId,
        type: 'system',
        title_ar: 'مرحباً بك في توفيري',
        title_en: 'Welcome to Tawveeri',
        message_ar: 'نحن سعداء بانضمامك إلينا',
        message_en: 'We are happy to have you join us',
      });

      // Audit log for signup
      await createAuditLog({
        user_id: userId,
        action: 'user_signup',
        entity_type: 'user',
        entity_id: userId,
        details: {
          method: 'phone',
          full_name: fullName || null,
        },
      });
    } else {
      // Existing user - update last login
      userId = existingUser.id;

      await supabase
        .from('users')
        .update({
          last_login_at: new Date().toISOString(),
          phone_verified: true,
        })
        .eq('id', userId);

      // Audit log for login
      await createAuditLog({
        user_id: userId,
        action: 'user_login',
        entity_type: 'user',
        entity_id: userId,
        details: { method: 'phone' },
      });
    }

    // Get the user from auth to verify creation
    const { data: authUserData, error: getUserError } = await supabase.auth.admin.getUserById(userId);

    if (getUserError || !authUserData.user) {
      console.error('Error getting user:', getUserError);
      return NextResponse.json(
        { error: 'Failed to retrieve user' },
        { status: 500 }
      );
    }

    // Generate a magic link for session creation
    // The client can use this to create a session
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      phone: formattedPhone,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?type=phone`,
      },
    });

    // Return user data
    // The client will use the magic link to create a session
    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        phone: formattedPhone,
        full_name: fullName || existingUser?.full_name || null,
        role: existingUser?.role || 'customer',
        phone_verified: true,
      },
      isNewUser,
      // Return magic link for session creation
      magicLink: linkData?.properties?.action_link || null,
      verificationToken: linkData?.properties?.hashed_token || null,
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

