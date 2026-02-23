import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient as createAdminClient } from '@/lib/database';
import { createServerClient } from '@supabase/ssr';
import { validateSaudiPhone } from '@/lib/auth/phone-validation';
import { createAuditLog } from '@/lib/auth/audit';
import { createNotification } from '@/lib/auth/notifications';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, otp, fullName, preferredLanguage, platform } = body;
    const isMobile = platform === 'mobile';

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

    // Create initial response for cookie handling
    const response = NextResponse.json({});

    // Create SSR client with cookie handlers for session management
    const supabaseSSR = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: any) {
            response.cookies.set({
              name,
              value: '',
              ...options,
            });
          },
        },
      }
    );

    // Create admin client for user creation operations
    const supabase = createAdminClient();

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

    // For phone auth, generateLink requires an email
    // We'll use a placeholder email to generate the magic link
    // Format: phone_<sanitized_phone>@tawveeri.local
    const sanitizedPhone = formattedPhone.replace(/[^0-9]/g, '');
    const placeholderEmail = `phone_${sanitizedPhone}@tawveeri.local`;
    
    // Update user with placeholder email temporarily
    const { error: emailUpdateError } = await supabase.auth.admin.updateUserById(userId, {
      email: placeholderEmail,
      email_confirm: true,
    });

    if (emailUpdateError) {
      console.error('Error setting placeholder email:', emailUpdateError);
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Generate a magic link using the placeholder email
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: placeholderEmail,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?type=phone`,
      },
    });

    if (linkError || !linkData) {
      console.error('Error generating magic link:', linkError);
      // Remove placeholder email on error
      await supabase.auth.admin.updateUserById(userId, {
        email: null,
      });
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Debug: Log the link data structure
    console.log('Magic link data:', {
      hasProperties: !!linkData.properties,
      propertiesKeys: linkData.properties ? Object.keys(linkData.properties) : [],
      action_link: linkData.properties?.action_link,
      hashed_token: linkData.properties?.hashed_token ? 'present' : 'missing',
    });

    // Extract code or token from magic link
    // generateLink can return either a code in the URL or a hashed_token in properties
    let code: string | null = null;
    let hashedToken: string | null = null;

    // Try to get code from URL
    try {
      const magicLinkUrl = new URL(linkData.properties.action_link);
      code = magicLinkUrl.searchParams.get('code');
    } catch (error) {
      console.log('Could not parse magic link URL, trying hashed_token');
    }

    // If no code in URL, try hashed_token from properties
    if (!code && linkData.properties.hashed_token) {
      hashedToken = linkData.properties.hashed_token;
    }

    if (!code && !hashedToken) {
      console.error('No code or hashed_token found in magic link', {
        action_link: linkData.properties.action_link,
        properties: linkData.properties,
      });
      // Remove placeholder email on error
      await supabase.auth.admin.updateUserById(userId, {
        email: null,
      });
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Exchange code/token for session using SSR client
    // This will automatically set cookies in the response
    let sessionData: any = null;
    let sessionError: any = null;

    if (code) {
      // Use code exchange method
      console.log('Using code exchange method');
      const result = await supabaseSSR.auth.exchangeCodeForSession(code);
      sessionData = result.data;
      sessionError = result.error;
    } else if (hashedToken) {
      // Use verifyOtp with hashed_token
      console.log('Using hashed_token verifyOtp method');
      const result = await supabaseSSR.auth.verifyOtp({
        token_hash: hashedToken,
        type: 'email',
      });
      sessionData = result.data;
      sessionError = result.error;
    } else {
      console.error('Neither code nor hashedToken available');
      // Remove placeholder email on error
      await supabase.auth.admin.updateUserById(userId, {
        email: null,
      });
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    if (sessionError || !sessionData?.session) {
      console.error('Error creating session:', sessionError, {
        hasSession: !!sessionData?.session,
        sessionDataKeys: sessionData ? Object.keys(sessionData) : [],
      });
      // Remove placeholder email on error
      await supabase.auth.admin.updateUserById(userId, {
        email: null,
      });
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Remove placeholder email after successful session creation
    // The session is established, so email is no longer needed for this flow
    await supabase.auth.admin.updateUserById(userId, {
      email: null,
    });

    // For mobile: return tokens directly (no cookies)
    if (isMobile) {
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
        session: {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
        },
      });
    }

    // Create final response with user data AND session tokens
    // Include tokens so the browser client can call setSession() directly,
    // which is more reliable than relying solely on server-set cookies.
    const finalResponse = NextResponse.json({
      success: true,
      user: {
        id: userId,
        phone: formattedPhone,
        full_name: fullName || existingUser?.full_name || null,
        role: existingUser?.role || 'customer',
        phone_verified: true,
      },
      isNewUser,
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      },
    });

    // Copy all cookies from the SSR response to the final response
    // This preserves the session cookies set during exchangeCodeForSession
    response.cookies.getAll().forEach((cookie) => {
      const cookieOptions: any = {};
      if (cookie.path) cookieOptions.path = cookie.path;
      if (cookie.domain) cookieOptions.domain = cookie.domain;
      if (cookie.maxAge !== undefined) cookieOptions.maxAge = cookie.maxAge;
      if (cookie.httpOnly !== undefined) cookieOptions.httpOnly = cookie.httpOnly;
      if (cookie.secure !== undefined) cookieOptions.secure = cookie.secure;
      if (cookie.sameSite) cookieOptions.sameSite = cookie.sameSite;

      finalResponse.cookies.set(cookie.name, cookie.value, cookieOptions);
    });

    return finalResponse;
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

