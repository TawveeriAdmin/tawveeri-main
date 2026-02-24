import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient as createAdminClient } from '@/lib/database';
import { createServerClient } from '@supabase/ssr';
import { validateSaudiPhone } from '@/lib/auth/phone-validation';
import { createAuditLog } from '@/lib/auth/audit';
import { createNotification, sendWelcomeEmail } from '@/lib/auth/notifications';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, otp, fullName, email, preferredLanguage, platform } = body;
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

    // If user doesn't exist, or exists but has no name/email — prompt for details
    // Don't mark OTP as used yet — user needs to provide name and email first
    const needsProfile = !existingUser || !existingUser.full_name || !existingUser.email;
    if (needsProfile && (!fullName || !email)) {
      return NextResponse.json({
        success: true,
        isNewUser: true,
        message: 'Please provide your name and email to create an account',
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
        email: email || undefined,
        phone_confirmed: true,
        email_confirm: true,
        user_metadata: {
          full_name: fullName || null,
          preferred_language: preferredLanguage || 'ar',
        },
      });

      if (createError || !authUser?.user) {
        // Phone or email already registered in Auth but no users table row — find and reuse
        const errorCode = (createError as any)?.code;
        if (errorCode === 'phone_exists' || errorCode === 'email_exists') {
          console.warn(`Auth user already exists (${errorCode}), searching by phone`);
          const phoneDigits = formattedPhone.replace(/[^0-9]/g, '');
          const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
          const found = listData?.users?.find((u) => {
            if (!u.phone) return false;
            return u.phone === formattedPhone || u.phone.replace(/[^0-9]/g, '') === phoneDigits;
          });

          if (found) {
            userId = found.id;
            // Update Auth user with any missing data
            await supabase.auth.admin.updateUserById(userId, {
              email: email || found.email || undefined,
              email_confirm: true,
              phone_confirm: true,
              user_metadata: {
                ...found.user_metadata,
                full_name: fullName || found.user_metadata?.full_name || null,
                preferred_language: preferredLanguage || found.user_metadata?.preferred_language || 'ar',
              },
            }).catch(() => {});
          } else {
            console.error('Could not find Auth user by phone after conflict:', createError);
            return NextResponse.json(
              { error: 'Failed to create user account' },
              { status: 500 }
            );
          }
        } else {
          console.error('Error creating user in Supabase Auth:', createError);
          return NextResponse.json(
            { error: 'Failed to create user account' },
            { status: 500 }
          );
        }
      } else {
        userId = authUser.user.id;
      }

      isNewUser = true;

      // Create user profile in users table
      const { error: profileError } = await supabase.from('users').insert({
        id: userId,
        phone: formattedPhone,
        email: email || null,
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

      // Send welcome email using the real email provided during signup
      if (email) {
        sendWelcomeEmail(email, fullName, preferredLanguage || 'ar').catch((err) =>
          console.error('Failed to send welcome email:', err)
        );
      }
    } else {
      // Existing user
      userId = existingUser.id;

      // Check if Auth user still exists (may have been deleted during testing)
      const { data: existingAuthUser, error: authCheckError } = await supabase.auth.admin.getUserById(userId);

      if (authCheckError || !existingAuthUser?.user) {
        // Stale reference: users table ID doesn't match any Auth user.
        // First, try to find the Auth user by phone (may exist under a different ID).
        console.warn('Auth user not found by ID, searching by phone');
        const stalePhoneDigits = formattedPhone.replace(/[^0-9]/g, '');
        const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const authByPhone = listData?.users?.find((u) => {
          if (!u.phone) return false;
          return u.phone === formattedPhone || u.phone.replace(/[^0-9]/g, '') === stalePhoneDigits;
        });

        let resolvedUserId: string;

        if (authByPhone) {
          // Auth user exists with this phone under a different ID — relink
          resolvedUserId = authByPhone.id;
          // Update Auth user metadata if needed
          const updates: Record<string, any> = {};
          if (fullName && !authByPhone.user_metadata?.full_name) {
            updates.user_metadata = { ...authByPhone.user_metadata, full_name: fullName };
          }
          if (email && !authByPhone.email) {
            updates.email = email;
            updates.email_confirm = true;
          }
          if (Object.keys(updates).length > 0) {
            await supabase.auth.admin.updateUserById(resolvedUserId, updates).catch(() => {});
          }
        } else {
          // No Auth user with this phone at all — create one
          const { data: recreated, error: recreateError } = await supabase.auth.admin.createUser({
            phone: formattedPhone,
            email: email || existingUser.email || undefined,
            phone_confirmed: true,
            email_confirm: !!(email || existingUser.email),
            user_metadata: {
              full_name: fullName || existingUser.full_name || null,
              preferred_language: preferredLanguage || existingUser.preferred_language || 'ar',
            },
          });

          if (recreateError || !recreated?.user) {
            console.error('Error recreating Auth user:', recreateError);
            return NextResponse.json(
              { error: 'Failed to create user account' },
              { status: 500 }
            );
          }
          resolvedUserId = recreated.user.id;
        }

        // Delete old row and insert fresh one with correct Auth ID
        await supabase.from('users').delete().eq('id', userId);
        await supabase.from('users').insert({
          id: resolvedUserId,
          phone: formattedPhone,
          email: email || existingUser.email || null,
          full_name: fullName || existingUser.full_name || null,
          preferred_language: preferredLanguage || existingUser.preferred_language || 'ar',
          role: existingUser.role || 'customer',
          auth_provider: 'phone',
          phone_verified: true,
          email_verified: false,
          last_login_at: new Date().toISOString(),
        });
        userId = resolvedUserId;
      } else {
        // Auth user exists — normal login, backfill missing profile data
        const updateData: Record<string, any> = {
          last_login_at: new Date().toISOString(),
          phone_verified: true,
        };
        if (fullName && !existingUser.full_name) updateData.full_name = fullName;
        if (email && !existingUser.email) updateData.email = email;

        await supabase
          .from('users')
          .update(updateData)
          .eq('id', userId);

        // Also update Auth user metadata if name/email were backfilled
        if (fullName && !existingUser.full_name) {
          await supabase.auth.admin.updateUserById(userId, {
            user_metadata: { full_name: fullName },
          }).catch(() => {});
        }
        if (email && !existingUser.email) {
          await supabase.auth.admin.updateUserById(userId, {
            email: email,
            email_confirm: true,
          }).catch(() => {});
        }
      }

      // Audit log for login
      await createAuditLog({
        user_id: userId,
        action: 'user_login',
        entity_type: 'user',
        entity_id: userId,
        details: { method: 'phone' },
      });
    }

    // Get the user from auth (should always succeed now)
    const { data: authUserData, error: getUserError } = await supabase.auth.admin.getUserById(userId);

    if (getUserError || !authUserData?.user) {
      console.error('Error getting user:', getUserError);
      return NextResponse.json(
        { error: 'Failed to retrieve user' },
        { status: 500 }
      );
    }

    // For phone auth, generateLink requires an email.
    // New users have a real email set during createUser.
    // Existing users may have an email from their profile, otherwise use a placeholder.
    const sanitizedPhone = formattedPhone.replace(/[^0-9]/g, '');
    const placeholderEmail = `phone_${sanitizedPhone}@tawveeri.local`;
    const userEmail = isNewUser
      ? email
      : (authUserData.user.email || email || existingUser?.email || null);
    const usePlaceholder = !userEmail;
    const emailForLink = userEmail || placeholderEmail;

    // If we need a placeholder (existing user without email), set it temporarily
    if (usePlaceholder) {
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
    }

    // Generate a magic link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: emailForLink,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?type=phone`,
      },
    });

    if (linkError || !linkData) {
      console.error('Error generating magic link:', linkError);
      if (usePlaceholder) {
        await supabase.auth.admin.updateUserById(userId, { email: null });
      }
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Extract code or token from magic link
    let code: string | null = null;
    let hashedToken: string | null = null;

    try {
      const magicLinkUrl = new URL(linkData.properties.action_link);
      code = magicLinkUrl.searchParams.get('code');
    } catch (error) {
      console.log('Could not parse magic link URL, trying hashed_token');
    }

    if (!code && linkData.properties.hashed_token) {
      hashedToken = linkData.properties.hashed_token;
    }

    if (!code && !hashedToken) {
      console.error('No code or hashed_token found in magic link', {
        action_link: linkData.properties.action_link,
        properties: linkData.properties,
      });
      if (usePlaceholder) {
        await supabase.auth.admin.updateUserById(userId, { email: null });
      }
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Exchange code/token for session using SSR client
    let sessionData: any = null;
    let sessionError: any = null;

    if (code) {
      const result = await supabaseSSR.auth.exchangeCodeForSession(code);
      sessionData = result.data;
      sessionError = result.error;
    } else if (hashedToken) {
      const result = await supabaseSSR.auth.verifyOtp({
        token_hash: hashedToken,
        type: 'email',
      });
      sessionData = result.data;
      sessionError = result.error;
    } else {
      if (usePlaceholder) {
        await supabase.auth.admin.updateUserById(userId, { email: null });
      }
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
      if (usePlaceholder) {
        await supabase.auth.admin.updateUserById(userId, { email: null });
      }
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Only remove placeholder email after session creation — keep real emails
    if (usePlaceholder) {
      await supabase.auth.admin.updateUserById(userId, { email: null });
    }

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

