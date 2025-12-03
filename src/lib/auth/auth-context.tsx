'use client';

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/database';
import { UserRole } from '@/lib/database/types';
import { createAuditLog } from './audit';
import { createNotification } from './notifications';

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
  signInWithPhone: (phone: string, token: string, options?: { fullName?: string; preferredLanguage?: 'ar' | 'en' }) => Promise<AuthResponse>;
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
  data?: any;
  error?: AuthError | Error | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  // Fetch user profile data from database, create if doesn't exist
  const fetchUserProfile = async (userId: string, userEmail?: string) => {
    if (!supabase) return { role: 'customer', full_name: null, avatar_url: null, preferred_language: 'ar', phone: null, email_verified: false, phone_verified: false };
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role, full_name, avatar_url, preferred_language, phone, email_verified, phone_verified')
        .eq('id', userId)
        .single();

      if (error) {
        // If user profile doesn't exist, create it
        if (error.code === 'PGRST116') {
          console.log('User profile not found, creating...');

          const { data: newProfile, error: insertError } = await supabase
            .from('users')
            .insert({
              id: userId,
              email: userEmail,
              role: 'customer',
              auth_provider: 'email',
              email_verified: true,
            })
            .select('role, full_name, avatar_url, preferred_language, phone, email_verified, phone_verified')
            .single();

          if (insertError) {
            console.error('Error creating user profile:', insertError);
            return { role: 'customer', full_name: null, avatar_url: null, preferred_language: 'ar', phone: null, email_verified: false, phone_verified: false };
          }

          return newProfile;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Return default profile to prevent app from breaking
      return { role: 'customer', full_name: null, avatar_url: null, preferred_language: 'ar', phone: null, email_verified: false, phone_verified: false }; 
    }
  };

  // Initialize auth state
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);

      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id, session.user.email);
        setUser({ ...session.user, ...profile } as AuthUser);
      }

      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);

      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id, session.user.email);
        setUser({ ...session.user, ...profile } as AuthUser);
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

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
    options?: { fullName?: string; preferredLanguage?: 'ar' | 'en' }
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
          preferredLanguage: options?.preferredLanguage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: new Error(data.error || 'Failed to verify OTP') };
      }

      // Session is created server-side and cookies are set automatically
      // Wait a moment for cookies to be available, then force refresh
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Force refresh session to ensure cookies are read and state is updated
      // This will trigger onAuthStateChange if session exists
      await supabase.auth.refreshSession();
      
      // Also try to get session directly and update state immediately
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (sessionData?.session) {
        // Session found, update state immediately so UI updates without waiting for redirect
        const profile = await fetchUserProfile(sessionData.session.user.id, sessionData.session.user.email);
        setUser({ ...sessionData.session.user, ...profile } as AuthUser);
        setSession(sessionData.session);
      }

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
    try {
      if (user) {
        // Audit log before signing out
        await createAuditLog({
          user_id: user.id,
          action: 'user_logout',
          entity_type: 'user',
          entity_id: user.id,
        });
      }

      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('Error signing out:', error);
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

      if (user) {
        // Audit log
        await createAuditLog({
          user_id: user.id,
          action: 'password_changed',
          entity_type: 'user',
          entity_id: user.id,
        });

        // Notification
        await createNotification({
          user_id: user.id,
          type: 'system',
          title_ar: 'تم تغيير كلمة المرور',
          title_en: 'Password Changed',
          message_ar: 'تم تغيير كلمة المرور الخاصة بك بنجاح',
          message_en: 'Your password has been changed successfully',
        });
      }

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
        const profile = await fetchUserProfile(data.session.user.id, data.session.user.email);
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
