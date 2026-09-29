import { consumeOtp } from '@/lib/auth/consume-otp';
import { generateBoundPhoneLink } from '@/lib/auth/phone-session-link';
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

    // Check if user exists in users table BEFORE marking OTP as used
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', formattedPhone)
      .maybeSingle();

    if (userError) return NextResponse.json({ error: 'Verification unavailable' }, { status: 503 });

    let userId: string;
    let isNewUser = false;

    // If user doesn't exist, or exists but has no name/email — prompt for details
    // Don't mark OTP as used yet — user needs to provide name and email first
    const needsProfile = !existingUser || !existingUser.full_name || !existingUser.email;
    const completingProfile = !needsProfile || Boolean(fullName && email);
    const accepted = await consumeOtp(supabase, formattedPhone, otp, 'phone_signin', existingUser?.id ?? null, completingProfile);
    if (!accepted) return NextResponse.json({ error: 'Invalid or expired OTP code' }, { status: 400 });
    if (needsProfile && (!fullName || !email)) {
      return NextResponse.json({
        success: true,
        isNewUser: true,
        message: 'Please provide your name and email to create an account',
      });
    }

    if (userError || !existingUser) {
      // Create new user in Supabase Auth using Admin API
      const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
        phone: formattedPhone,
        // Phone possession does not verify the caller's supplied email.
        email: `phone_${formattedPhone.replace(/[^0-9]/g, '')}@tawveeri.local`,
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
        // Never delete/relink a profile or carry its role into a new identity.
        return NextResponse.json({ error: 'Account recovery is required. Please contact support.' }, { status: 409 });
      } else {
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

    // Use the Auth identity owning the consumed phone challenge, never a supplied email.
    const linkData = await generateBoundPhoneLink(supabase, userId, formattedPhone);

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
      console.error('No session token returned for verified phone account');
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

      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    if (sessionError || !sessionData?.session || sessionData.user?.id !== userId) {
      console.error('Error creating session:', sessionError, {
        hasSession: !!sessionData?.session,
        sessionDataKeys: sessionData ? Object.keys(sessionData) : [],
      });

      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
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

