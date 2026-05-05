'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/database';
import { UserRole } from '@/lib/database/types';
import { createAuditLog } from './audit';
import { createNotification, sendWelcomeEmail } from './notifications';

interface AuthUser extends Omit<User, 'phone'> {
  role?: UserRole;
  full_name?: string;
  avatar_url?: string | null;
  preferred_language?: string;
  phone?: string | null;
  email_verified?: boolean;
  phone_verified?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signUp: (params: SignUpParams) => Promise<AuthResponse>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResponse>;
  signInWithPhone: (phone: string, token: string, options?: { fullName?: string; email?: string; preferredLanguage?: 'ar' | 'en' }) => Promise<AuthResponse>;
  sendPhoneOtp: (phone: string, options?: { shouldCreateUser?: boolean }) => Promise<AuthResponse>;
  signInWithOAuth: (provider: 'google' | 'facebook' | 'apple') => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResponse>;
  updatePassword: (newPassword: string) => Promise<AuthResponse>;
  updateProfile: (data: ProfileUpdateData) => Promise<AuthResponse>;
  refreshSession: () => Promise<void>;
}

interface SignUpParams {
  email?: string;
  phone?: string;
  password: string;
  full_name?: string;
  preferred_language?: 'ar' | 'en';
}

interface ProfileUpdateData {
  full_name?: string;
  avatar_url?: string;
  preferred_language?: 'ar' | 'en';
}

interface AuthResponse {
  // Payload shape varies by auth method (email, phone OTP, OAuth).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  error?: AuthError | Error | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_LOADING_TIMEOUT_MS = 5000;
const PROFILE_LOADING_TIMEOUT_MS = 4000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(
    () => (typeof window !== 'undefined' ? getSupabaseBrowserClient() : null),
    []
  );

  const fallbackValue = useMemo<AuthContextType>(
    () => ({
      user: null,
      session: null,
      loading: true,
      signUp: async () => ({ error: new Error('Supabase client not initialized') }),
      signInWithEmail: async () => ({ error: new Error('Supabase client not initialized') }),
      signInWithPhone: async () => ({ error: new Error('Supabase client not initialized') }),
      sendPhoneOtp: async () => ({ error: new Error('Supabase client not initialized') }),
      signInWithOAuth: async () => ({ error: new Error('Supabase client not initialized') }),
      signOut: async () => undefined,
      resetPassword: async () => ({ error: new Error('Supabase client not initialized') }),
      updatePassword: async () => ({ error: new Error('Supabase client not initialized') }),
      updateProfile: async () => ({ error: new Error('Supabase client not initialized') }),
      refreshSession: async () => undefined,
    }),
    []
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const authRequestIdRef = useRef(0);

  type UserProfileShape = Pick<
    AuthUser,
    'role' | 'full_name' | 'avatar_url' | 'preferred_language' | 'phone' | 'email_verified' | 'phone_verified'
  >;

  const getDefaultProfile = useCallback(
    (): UserProfileShape => ({
      role: 'customer',
      full_name: null,
      avatar_url: null,
      preferred_language: 'ar',
      phone: null,
      email_verified: false,
      phone_verified: false,
    }),
    []
  );

  const normalizeProfile = useCallback(
    (profile: Partial<UserProfileShape> | null | undefined): UserProfileShape => ({
      ...getDefaultProfile(),
      ...(profile || {}),
    }),
    [getDefaultProfile]
  );

  // Fetch user profile data from database, create if doesn't exist
  const fetchUserProfile = useCallback(async (authUser: User): Promise<UserProfileShape> => {
    if (!supabase) return getDefaultProfile();
    const profileSelect =
      'role, full_name, avatar_url, preferred_language, phone, email_verified, phone_verified';

    try {
      const { data, error } = await supabase
        .from('users')
        .select(profileSelect)
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) {
        const raw = JSON.stringify(error, Object.getOwnPropertyNames(error as object));
        console.error('Error fetching user profile:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          name: (error as { name?: string }).name,
          raw,
          userId: authUser.id,
        });
        return getDefaultProfile();
      }

      if (data) {
        const profile = normalizeProfile(data);
        // Preserve Auth user's phone if the users table has null
        if (!profile.phone && authUser.phone) profile.phone = authUser.phone;
        // Trust Auth phone_confirmed_at over users table flag
        if (!profile.phone_verified && authUser.phone_confirmed_at) profile.phone_verified = true;
        return profile;
      }

      // Profile row is missing; create it using authenticated user metadata.
      const provider = authUser.app_metadata?.provider;
      const authProvider =
        provider === 'google' || provider === 'facebook' || provider === 'apple'
          ? provider
          : authUser.phone
            ? 'phone'
            : 'email';
      const fullNameMeta =
        typeof authUser.user_metadata?.full_name === 'string'
          ? authUser.user_metadata.full_name
          : typeof authUser.user_metadata?.name === 'string'
            ? authUser.user_metadata.name
            : null;
      const preferredLanguageMeta =
        authUser.user_metadata?.preferred_language === 'en' ||
        authUser.user_metadata?.preferred_language === 'ar'
          ? authUser.user_metadata.preferred_language
          : 'ar';

      let { data: createdProfile, error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email || null,
          phone: authUser.phone || null,
          full_name: fullNameMeta,
          role: 'customer',
          auth_provider: authProvider,
          email_verified: Boolean(authUser.email_confirmed_at),
          phone_verified: Boolean(authUser.phone_confirmed_at),
          preferred_language: preferredLanguageMeta,
        })
        .select(profileSelect)
        .maybeSingle();

      // Retry with minimal payload in case stale unique email/phone data exists.
      if (insertError) {
        const retry = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            role: 'customer',
            auth_provider: authProvider,
          })
          .select(profileSelect)
          .maybeSingle();
        createdProfile = retry.data;
        insertError = retry.error;
      }

      if (insertError) {
        // Handle race condition where another flow inserted the row between calls.
        const { data: existingProfile } = await supabase
          .from('users')
          .select(profileSelect)
          .eq('id', authUser.id)
          .maybeSingle();

        if (existingProfile) {
          return normalizeProfile(existingProfile);
        }

        console.warn('Unable to create missing user profile, using defaults:', {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          userId: authUser.id,
        });
        return getDefaultProfile();
      }

      return normalizeProfile(createdProfile);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Return default profile to prevent app from breaking
      return getDefaultProfile();
    }
  }, [getDefaultProfile, normalizeProfile, supabase]);

  // Initialize auth state
  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;
    const getOptimisticProfile = (authUser: User): UserProfileShape =>
      normalizeProfile({
        full_name:
          typeof authUser.user_metadata?.full_name === 'string'
            ? authUser.user_metadata.full_name
            : typeof authUser.user_metadata?.name === 'string'
              ? authUser.user_metadata.name
              : null,
        preferred_language:
          authUser.user_metadata?.preferred_language === 'en' ||
          authUser.user_metadata?.preferred_language === 'ar'
            ? authUser.user_metadata.preferred_language
            : 'ar',
        phone: authUser.phone || null,
        email_verified: Boolean(authUser.email_confirmed_at),
        phone_verified: Boolean(authUser.phone_confirmed_at),
      });

    const hydrateUserState = async (authUser: User, requestId: number) => {
      try {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        const timeoutProfile = new Promise<UserProfileShape>((resolve) => {
          timeoutId = setTimeout(() => {
            resolve(getOptimisticProfile(authUser));
          }, PROFILE_LOADING_TIMEOUT_MS);
        });

        const profile = await Promise.race([fetchUserProfile(authUser), timeoutProfile]);
        if (timeoutId) clearTimeout(timeoutId);

        if (requestId !== authRequestIdRef.current) return;
        setUser({ ...authUser, ...profile } as AuthUser);
      } catch (error) {
        console.error('Error hydrating user state:', error);
        if (requestId !== authRequestIdRef.current) return;
        setUser({ ...authUser, ...getOptimisticProfile(authUser) } as AuthUser);
      }
    };

    const applySession = (nextSession: Session | null) => {
      if (!isMounted) return null;

      const requestId = ++authRequestIdRef.current;
      setSession(nextSession);

      if (nextSession?.user) {
        setUser({ ...nextSession.user, ...getOptimisticProfile(nextSession.user) } as AuthUser);
      } else {
        setUser(null);
      }

      setLoading(false);
      return requestId;
    };

    const loadingTimeout = window.setTimeout(() => {
      if (!isMounted) return;
      console.warn('Auth initialization timed out; unblocking UI.');
      setLoading(false);
    }, AUTH_LOADING_TIMEOUT_MS);

    void supabase.auth.getSession().then(({ data: { session } }) => {
      const requestId = applySession(session);
      if (requestId && session?.user) {
        void hydrateUserState(session.user, requestId);
      }
    }).catch((err) => {
      console.error('Error getting session:', err);
      if (isMounted) setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const requestId = applySession(nextSession);
      if (requestId && nextSession?.user) {
        // Run profile fetch outside auth callback to avoid session lock deadlocks.
        window.setTimeout(() => {
          if (!isMounted) return;
          void hydrateUserState(nextSession.user, requestId);
        }, 0);
      }
    });

    return () => {
      isMounted = false;
      authRequestIdRef.current += 1;
      window.clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, [fetchUserProfile, normalizeProfile, supabase]);

  // Sign up with email or phone
  const signUp = async (params: SignUpParams): Promise<AuthResponse> => {
    if (!supabase) {
      return { error: new Error('Supabase client not initialized') };
    }
    try {
      const { email, phone, password, full_name, preferred_language } = params;

      // Sign up with Supabase Auth
      const authData = email
        ? { email, password }
        : { phone: phone!, password };

      const { data, error } = await supabase.auth.signUp(authData);

      if (error) throw error;

      // Create user profile in database
      if (data.user) {
        const { error: profileError } = await supabase.from('users').insert({
          id: data.user.id,
          email: email || null,
          phone: phone || null,
          full_name: full_name || null,
          preferred_language: preferred_language || 'ar',
          role: 'customer',
          auth_provider: email ? 'email' : 'phone',
        });

        if (profileError) {
          console.error('Error creating user profile:', profileError);
        }

        // Create welcome notification
        await createNotification({
          user_id: data.user.id,
          type: 'system',
          title_ar: 'مرحباً بك في توفيري',
          title_en: 'Welcome to Tawveeri',
          message_ar: 'نحن سعداء بانضمامك إلينا',
          message_en: 'We are happy to have you join us',
        });

        // Audit log
        await createAuditLog({
          user_id: data.user.id,
          action: 'user_signup',
          entity_type: 'user',
          entity_id: data.user.id,
          details: {
            method: email ? 'email' : 'phone',
            full_name,
          },
        });

        // Send welcome email (fire-and-forget)
        if (email) {
          sendWelcomeEmail(email, full_name, preferred_language).catch(() => {});
        }
      }

      return { data, error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Sign in with email
  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<AuthResponse> => {
    if (!supabase) {
      return { error: new Error('Supabase client not initialized') };
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Update last login
        await supabase
          .from('users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', data.user.id);

        // Audit log
        await createAuditLog({
          user_id: data.user.id,
          action: 'user_login',
          entity_type: 'user',
          entity_id: data.user.id,
          details: { method: 'email' },
        });

        // Check for new device (fire-and-forget)
        fetch('/api/auth/check-device', { method: 'POST' }).catch(() => {});
      }

      return { data, error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const sendPhoneOtp = async (
    phone: string,
    options?: { shouldCreateUser?: boolean }
  ): Promise<AuthResponse> => {
    try {
      // Use absolute path to avoid locale prefix issues
      const baseUrl = typeof window !== 'undefined' 
        ? window.location.origin 
        : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/auth/send-phone-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          shouldCreateUser: options?.shouldCreateUser ?? false,
        }),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response from API:', text.substring(0, 200));
        return { error: new Error('Server returned an invalid response. Please check the server logs.') };
      }

      const data = await response.json();

      if (!response.ok) {
        return { error: new Error(data.error || 'Failed to send OTP') };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Send OTP error:', error);
      return { error: error as Error };
    }
  };

  // Sign in or verify with phone OTP
  const signInWithPhone = async (
    phone: string,
    token: string,
    options?: { fullName?: string; email?: string; preferredLanguage?: 'ar' | 'en' }
  ): Promise<AuthResponse> => {
    if (!supabase) {
      return { error: new Error('Supabase client not initialized') };
    }
    try {
      // Use absolute path to avoid locale prefix issues
      const baseUrl = typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/auth/verify-phone-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Ensure cookies are sent and received
        body: JSON.stringify({
          phone,
          otp: token,
          fullName: options?.fullName,
          email: options?.email,
          preferredLanguage: options?.preferredLanguage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: new Error(data.error || 'Failed to verify OTP') };
      }

      // Establish the session on the browser Supabase client directly using
      // the tokens returned by the API. This is more reliable than relying
      // solely on server-set cookies — setSession() stores the tokens in the
      // client's cookie storage and triggers onAuthStateChange.
      // Unlike refreshSession(), setSession() is a local operation (no API call)
      // so it won't deadlock or hold the session lock indefinitely.
      if (data.session?.access_token && data.session?.refresh_token) {
        try {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
        } catch {
          // Non-fatal — the page reload will establish the session from cookies
        }
      }

      // Check for new device (fire-and-forget)
      fetch('/api/auth/check-device', { method: 'POST' }).catch(() => {});

      return { data, error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Sign in with OAuth (Google, Facebook, Apple)
  const signInWithOAuth = async (
    provider: 'google' | 'facebook' | 'apple'
  ): Promise<AuthResponse> => {
    if (!supabase) {
      return { error: new Error('Supabase client not initialized') };
    }
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        },
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Sign out
  const signOut = async () => {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return;
    }
    const userId = user?.id ?? null;

    try {
      const serverSignOut = fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include',
      }).catch((error) => {
        console.warn('Server sign-out request failed:', error);
      });

      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });

      if (signOutError) {
        console.error('Client sign-out failed; continuing server cookie cleanup:', signOutError);
      }

      await serverSignOut;

      setUser(null);
      setSession(null);

      // Clear all browser storage
      localStorage.clear();
      sessionStorage.clear();

      if (userId) {
        void createAuditLog({
          user_id: userId,
          action: 'user_logout',
          entity_type: 'user',
          entity_id: userId,
        });
      }
    } catch (error) {
      console.error('Error signing out:', error);
      setUser(null);
      setSession(null);
      localStorage.clear();
      sessionStorage.clear();
    }
  };

  // Reset password
  const resetPassword = async (email: string): Promise<AuthResponse> => {
    if (!supabase) {
      return { error: new Error('Supabase client not initialized') };
    }
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Update password
  const updatePassword = async (newPassword: string): Promise<AuthResponse> => {
    if (!supabase) {
      return { error: new Error('Supabase client not initialized') };
    }
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      // Notification, email, and audit log are handled server-side
      // via /api/auth/password-changed-notify called from the profile page

      return { data, error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Update user profile
  const updateProfile = async (
    profileData: ProfileUpdateData
  ): Promise<AuthResponse> => {
    if (!supabase) {
      return { error: new Error('Supabase client not initialized') };
    }
    try {
      if (!user) throw new Error('No user logged in');

      const { data, error } = await supabase
        .from('users')
        .update(profileData)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Update local user state
      setUser({ ...user, ...data } as AuthUser);

      // Audit log
      await createAuditLog({
        user_id: user.id,
        action: 'profile_updated',
        entity_type: 'user',
        entity_id: user.id,
        details: profileData,
      });

      return { data, error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Refresh session
  const refreshSession = async () => {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return;
    }
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;

      setSession(data.session);
      if (data.session?.user) {
        const profile = await fetchUserProfile(data.session.user);
        setUser({ ...data.session.user, ...profile } as AuthUser);
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
    }
  };

  if (!supabase) {
    return <AuthContext.Provider value={fallbackValue}>{children}</AuthContext.Provider>;
  }

  const value = {
    user,
    session,
    loading,
    signUp,
    signInWithEmail,
    signInWithPhone,
    sendPhoneOtp,
    signInWithOAuth,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export type { AuthUser };
