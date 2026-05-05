import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient as createAdminClient } from '@/lib/database';
import { createServerClient } from '@supabase/ssr';
import { validateSaudiPhone } from '@/lib/auth/phone-validation';
import { createAuditLog } from '@/lib/auth/audit';
import { createNotification, sendWelcomeEmail, sendNewDeviceLoginEmail } from '@/lib/auth/notifications';
import { createHash } from 'crypto';

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
    let authEmail: string | null = null; // Track auth user email to avoid redundant getUserById

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
        phone_confirm: true,
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
      authEmail = email || null;

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
            phone_confirm: true,
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
        authEmail = email || existingUser.email || null;
      } else {
        authEmail = existingAuthUser.user.email || email || existingUser?.email || null;
        // Auth user exists — normal login, backfill missing profile data
        const updateData: Record<string, any> = {
          last_login_at: new Date().toISOString(),
          phone_verified: true,
        };
        if (fullName && !existingUser.full_name) updateData.full_name = fullName;
        if (email && !existingUser.email) updateData.email = email;

        // Run profile update + auth metadata updates in parallel
        const parallelUpdates: Promise<any>[] = [
          Promise.resolve(supabase.from('users').update(updateData).eq('id', userId)),
        ];
        if (fullName && !existingUser.full_name) {
          parallelUpdates.push(
            supabase.auth.admin.updateUserById(userId, {
              user_metadata: { full_name: fullName },
            }).catch(() => {})
          );
        }
        if (email && !existingUser.email) {
          parallelUpdates.push(
            supabase.auth.admin.updateUserById(userId, {
              email: email,
              email_confirm: true,
            }).catch(() => {})
          );
        }
        await Promise.all(parallelUpdates);
      }

      // Audit log for login (fire-and-forget)
      createAuditLog({
        user_id: userId,
        action: 'user_login',
        entity_type: 'user',
        entity_id: userId,
        details: { method: 'phone' },
      }).catch(() => {});
    }

    // For phone auth, generateLink requires an email.
    // authEmail was tracked through new/existing user paths above.
    const sanitizedPhone = formattedPhone.replace(/[^0-9]/g, '');
    const placeholderEmail = `phone_${sanitizedPhone}@tawveeri.local`;
    const usePlaceholder = !authEmail;
    const emailForLink = authEmail || placeholderEmail;

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
        await supabase.auth.admin.updateUserById(userId, { email: undefined });
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
        await supabase.auth.admin.updateUserById(userId, { email: undefined });
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
        await supabase.auth.admin.updateUserById(userId, { email: undefined });
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
        await supabase.auth.admin.updateUserById(userId, { email: undefined });
      }
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Only remove placeholder email after session creation — keep real emails
    // Fire-and-forget to avoid blocking the response
    if (usePlaceholder) {
      supabase.auth.admin.updateUserById(userId, { email: undefined }).catch(() => {});
    }

    // Build response payload (shared between mobile and web)
    const responsePayload = {
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
    };

    // Device fingerprinting + new device notifications (fire-and-forget)
    (async () => {
      try {
        const userAgent = request.headers.get('user-agent') || 'unknown';
        const forwarded = request.headers.get('x-forwarded-for');
        const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '0.0.0.0';
        const ipParts = ip.split('.').slice(0, 3).join('.');
        const fingerprint = createHash('sha256').update(`${userAgent}:${ipParts}`).digest('hex');

        const { data: existingSession } = await supabase
          .from('login_sessions')
          .select('id')
          .eq('user_id', userId)
          .eq('device_fingerprint', fingerprint)
          .maybeSingle();

        if (!existingSession) {
          await supabase.from('login_sessions').insert({
            user_id: userId,
            device_fingerprint: fingerprint,
            user_agent: userAgent,
            ip_address: ip,
            is_known_device: true,
          });

          if (!isNewUser) {
            const deviceInfo = userAgent.includes('iPhone') ? 'iPhone'
              : userAgent.includes('Android') ? 'Android'
              : userAgent.includes('Windows') ? 'Windows PC'
              : userAgent.includes('Macintosh') ? 'Mac'
              : 'Unknown Device';

            createNotification({
              user_id: userId,
              type: 'system',
              title_ar: 'تسجيل دخول من جهاز جديد',
              title_en: 'Login from New Device',
              message_ar: `تم تسجيل دخول إلى حسابك من جهاز جديد: ${deviceInfo}`,
              message_en: `Your account was accessed from a new device: ${deviceInfo}`,
            }).catch(() => {});

            const notifEmail = email || existingUser?.email;
            if (notifEmail) {
              sendNewDeviceLoginEmail(
                notifEmail,
                { device_info: deviceInfo, login_time: new Date().toLocaleString('en-US') },
              ).catch(() => {});
            }

            createAuditLog({
              user_id: userId,
              action: 'new_device_login',
              entity_type: 'user',
              entity_id: userId,
              details: { device_info: deviceInfo, ip_address: ip },
              user_agent: userAgent,
              ip_address: ip,
            }).catch(() => {});
          }
        } else {
          await supabase
            .from('login_sessions')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', existingSession.id);
        }
      } catch (err) {
        console.error('Device check error in phone OTP:', err);
      }
    })();

    // For mobile: return tokens directly (no cookies)
    if (isMobile) {
      return NextResponse.json(responsePayload);
    }

    // Web: include session cookies
    const finalResponse = NextResponse.json(responsePayload);

    // Copy all cookies from the SSR response to the final response
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

