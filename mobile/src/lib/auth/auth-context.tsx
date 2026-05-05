/**
 * Mobile auth provider adapted from web's auth-context.tsx.
 *
 * Differences from web:
 * - Uses Supabase client with SecureStore (no SSR cookies)
 * - Phone OTP calls Next.js API endpoints via apiClient with platform=mobile
 * - OAuth uses expo-web-browser + deep link redirect
 * - No `typeof window` guards needed
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/src/lib/supabase/client';
import { apiClient } from '@/src/lib/api/client';

// Types
export type UserRole = 'admin' | 'customer' | 'store' | 'guest';

export interface AuthUser extends Omit<User, 'phone'> {
  role?: UserRole;
  full_name?: string;
  avatar_url?: string | null;
  preferred_language?: string;
  phone?: string | null;
  email_verified?: boolean;
  phone_verified?: boolean;
}

interface AuthResponse {
  data?: any;
  error?: AuthError | Error | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signUp: (params: { email?: string; phone?: string; password: string; full_name?: string; preferred_language?: 'ar' | 'en' }) => Promise<AuthResponse>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResponse>;
  signInWithPhone: (phone: string, token: string, options?: { fullName?: string; email?: string; preferredLanguage?: 'ar' | 'en' }) => Promise<AuthResponse>;
  sendPhoneOtp: (phone: string) => Promise<AuthResponse>;
  signInWithOAuth: (provider: 'google' | 'facebook' | 'apple') => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResponse>;
  updatePassword: (newPassword: string) => Promise<AuthResponse>;
  updateProfile: (data: { full_name?: string; avatar_url?: string; preferred_language?: 'ar' | 'en' }) => Promise<AuthResponse>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Profile fetching
type ProfileShape = Pick<AuthUser, 'role' | 'full_name' | 'avatar_url' | 'preferred_language' | 'phone' | 'email_verified' | 'phone_verified'>;

const DEFAULT_PROFILE: ProfileShape = {
  role: 'customer',
  full_name: undefined,
  avatar_url: null,
  preferred_language: 'ar',
  phone: null,
  email_verified: false,
  phone_verified: false,
};

async function fetchUserProfile(authUser: User): Promise<ProfileShape> {
  const profileSelect = 'role, full_name, avatar_url, preferred_language, phone, email_verified, phone_verified';

  try {
    const { data, error } = await supabase
      .from('users')
      .select(profileSelect)
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error.message);
      return DEFAULT_PROFILE;
    }

    if (data) return { ...DEFAULT_PROFILE, ...data };

    // Create profile if missing
    const provider = authUser.app_metadata?.provider;
    const authProvider =
      provider === 'google' || provider === 'facebook' || provider === 'apple'
        ? provider
        : authUser.phone ? 'phone' : 'email';

    const fullName =
      typeof authUser.user_metadata?.full_name === 'string'
        ? authUser.user_metadata.full_name
        : typeof authUser.user_metadata?.name === 'string'
          ? authUser.user_metadata.name
          : null;

    const { data: created, error: insertError } = await supabase
      .from('users')
      .insert({
        id: authUser.id,
        email: authUser.email || null,
        phone: authUser.phone || null,
        full_name: fullName,
        role: 'customer',
        auth_provider: authProvider,
        email_verified: Boolean(authUser.email_confirmed_at),
        phone_verified: Boolean(authUser.phone_confirmed_at),
      })
      .select(profileSelect)
      .maybeSingle();

    if (insertError) {
      // Race condition: another flow may have inserted
      const { data: existing } = await supabase
        .from('users')
        .select(profileSelect)
        .eq('id', authUser.id)
        .maybeSingle();
      if (existing) return { ...DEFAULT_PROFILE, ...existing };
      return DEFAULT_PROFILE;
    }

    return { ...DEFAULT_PROFILE, ...created };
  } catch (err) {
    console.error('Profile fetch error:', err);
    return DEFAULT_PROFILE;
  }
}

// Provider
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Init: get existing session
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const profile = await fetchUserProfile(session.user);
        setUser({ ...session.user, ...profile } as AuthUser);
        apiClient.setAccessToken(session.access_token);
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        const profile = await fetchUserProfile(session.user);
        setUser({ ...session.user, ...profile } as AuthUser);
        apiClient.setAccessToken(session.access_token);
      } else {
        setUser(null);
        apiClient.setAccessToken(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sign up
  const signUp = useCallback(async (params: { email?: string; phone?: string; password: string; full_name?: string; preferred_language?: 'ar' | 'en' }): Promise<AuthResponse> => {
    try {
      const { email, phone, password } = params;
      const authData = email ? { email, password } : { phone: phone!, password };
      const { data, error } = await supabase.auth.signUp(authData);
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  // Email sign in
  const signInWithEmail = useCallback(async (email: string, password: string): Promise<AuthResponse> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Ensure auth state is updated before returning
      if (data.session?.user) {
        const profile = await fetchUserProfile(data.session.user);
        setUser({ ...data.session.user, ...profile } as AuthUser);
        setSession(data.session);
        apiClient.setAccessToken(data.session.access_token);
      }
      return { data, error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  // Send phone OTP
  const sendPhoneOtp = useCallback(async (phone: string): Promise<AuthResponse> => {
    try {
      const data = await apiClient.post('/api/auth/send-phone-otp', {
        phone,
        shouldCreateUser: false,
      });
      return { data, error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  // Verify phone OTP + establish session
  const signInWithPhone = useCallback(async (
    phone: string,
    token: string,
    options?: { fullName?: string; email?: string; preferredLanguage?: 'ar' | 'en' }
  ): Promise<AuthResponse> => {
    try {
      // Call verify endpoint with platform=mobile
      const data = await apiClient.post<{
        success: boolean;
        isNewUser?: boolean;
        session?: {
          access_token: string;
          refresh_token: string;
        };
      }>('/api/auth/verify-phone-otp', {
        phone,
        otp: token,
        fullName: options?.fullName,
        email: options?.email,
        preferredLanguage: options?.preferredLanguage,
        platform: 'mobile',
      });

      // If API returned tokens directly, set Supabase session
      if (data.session?.access_token && data.session?.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        if (sessionError) {
          console.error('setSession failed:', sessionError.message);
          throw sessionError;
        }
        // Ensure auth state is updated before returning
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.user) {
          const profile = await fetchUserProfile(currentSession.user);
          setUser({ ...currentSession.user, ...profile } as AuthUser);
          setSession(currentSession);
          apiClient.setAccessToken(currentSession.access_token);
        }
      }

      return { data, error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  // OAuth
  const signInWithOAuth = useCallback(async (provider: 'google' | 'facebook' | 'apple'): Promise<AuthResponse> => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: 'tawveeri://auth/callback',
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;

      // Open URL in in-app browser
      if (data.url) {
        const WebBrowser = await import('expo-web-browser');
        const result = await WebBrowser.openAuthSessionAsync(data.url, 'tawveeri://auth/callback');

        if (result.type === 'success' && result.url) {
          // Extract tokens from callback URL
          const url = new URL(result.url);
          const accessToken = url.searchParams.get('access_token') ||
            url.hash?.match(/access_token=([^&]+)/)?.[1];
          const refreshToken = url.searchParams.get('refresh_token') ||
            url.hash?.match(/refresh_token=([^&]+)/)?.[1];

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          }
        }
      }

      return { data, error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      await supabase.auth.signOut({ scope: 'local' });
    }
    setUser(null);
    setSession(null);
    apiClient.setAccessToken(null);
  }, []);

  // Reset password
  const resetPassword = useCallback(async (email: string): Promise<AuthResponse> => {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  // Update password
  const updatePassword = useCallback(async (newPassword: string): Promise<AuthResponse> => {
    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  // Update profile
  const updateProfile = useCallback(async (profileData: { full_name?: string; avatar_url?: string; preferred_language?: 'ar' | 'en' }): Promise<AuthResponse> => {
    try {
      if (!user) throw new Error('No user logged in');
      const { data, error } = await supabase
        .from('users')
        .update(profileData)
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw error;
      setUser({ ...user, ...data } as AuthUser);
      return { data, error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, [user]);

  // Refresh
  const refreshSession = useCallback(async () => {
    try {
      const { data } = await supabase.auth.refreshSession();
      setSession(data.session);
      if (data.session?.user) {
        const profile = await fetchUserProfile(data.session.user);
        setUser({ ...data.session.user, ...profile } as AuthUser);
        apiClient.setAccessToken(data.session.access_token);
      }
    } catch (err) {
      console.error('Error refreshing session:', err);
    }
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user, session, loading,
    signUp, signInWithEmail, signInWithPhone, sendPhoneOtp, signInWithOAuth,
    signOut, resetPassword, updatePassword, updateProfile, refreshSession,
  }), [user, session, loading, signUp, signInWithEmail, signInWithPhone, sendPhoneOtp, signInWithOAuth, signOut, resetPassword, updatePassword, updateProfile, refreshSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
