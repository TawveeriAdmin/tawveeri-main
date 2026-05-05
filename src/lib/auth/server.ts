/**
 * Server-side Auth Utilities
 * For use in Server Components and API routes
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { UserRole } from '@/lib/database/types';

/**
 * Create Supabase client for Server Components
 * Uses React cache to avoid creating multiple instances
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Cookie setting can fail in Server Components
            // This is fine during the render phase
          }
        },
        remove(name: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Cookie removal can fail in Server Components
          }
        },
      },
    }
  );
});

const getConfiguredAdminEmails = cache(() => {
  const raw = [
    process.env.ADMIN_EMAILS,
    process.env.ADMIN_EMAIL,
    process.env.NEXT_PUBLIC_ADMIN_EMAILS,
  ]
    .filter(Boolean)
    .join(',');

  const parsed = raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return new Set(parsed);
});

const isConfiguredAdminEmail = (email?: string | null) => {
  if (!email) return false;
  return getConfiguredAdminEmails().has(email.trim().toLowerCase());
};

/**
 * Get current session on server
 */
export async function getSession() {
  const user = await getUser();
  if (!user) return null;
  return { user };
}

/**
 * Get current user on server
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Get user profile with role from database
 */
export async function getUserProfile() {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) return null;

  const profileSelect = 'id, email, phone, full_name, role, avatar_url, preferred_language, email_verified, phone_verified';
  const isBootstrapAdmin = isConfiguredAdminEmail(user.email);
  const fallbackRole: UserRole = isBootstrapAdmin ? 'admin' : 'customer';

  const { data, error } = await supabase
    .from('users')
    .select(profileSelect)
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user profile:', error);
    return {
      ...user,
      role: fallbackRole,
      preferred_language: 'ar',
      email_verified: Boolean(user.email_confirmed_at),
      phone_verified: Boolean(user.phone_confirmed_at),
    };
  }

  if (!data) {
    const { data: created } = await supabase
      .from('users')
      .insert({
        id: user.id,
        email: user.email || null,
        phone: user.phone || null,
        full_name:
          typeof user.user_metadata?.full_name === 'string'
            ? user.user_metadata.full_name
            : typeof user.user_metadata?.name === 'string'
              ? user.user_metadata.name
              : null,
        role: fallbackRole,
        auth_provider: user.phone ? 'phone' : 'email',
        email_verified: Boolean(user.email_confirmed_at),
        phone_verified: Boolean(user.phone_confirmed_at),
        preferred_language:
          user.user_metadata?.preferred_language === 'en' ||
          user.user_metadata?.preferred_language === 'ar'
            ? user.user_metadata.preferred_language
            : 'ar',
      })
      .select(profileSelect)
      .maybeSingle();

    return {
      ...user,
      ...(created || {}),
      email: created?.email ?? user.email,
      full_name: created?.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      phone: created?.phone ?? user.phone,
      role: (created?.role as UserRole | undefined) ?? fallbackRole,
    };
  }

  if (isBootstrapAdmin && data.role !== 'admin') {
    // Best effort: keep DB role consistent for bootstrap admin accounts.
    await supabase
      .from('users')
      .update({ role: 'admin' })
      .eq('id', user.id);
  }

  return {
    ...user,
    ...data,
    email: data.email ?? user.email,
    full_name: data.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    phone: data.phone ?? user.phone,
    role: isBootstrapAdmin ? 'admin' : data.role,
  };
}

/**
 * Check if user is admin
 */
export async function isAdmin() {
  const profile = await getUserProfile();
  return profile?.role === 'admin';
}

/**
 * Check if user is store
 */
export async function isStore() {
  const profile = await getUserProfile();
  return profile?.role === 'store';
}

/**
 * Check if user is customer
 */
export async function isCustomer() {
  const profile = await getUserProfile();
  return profile?.role === 'customer';
}

/**
 * Require authentication (redirect to login if not authenticated)
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error('Authentication required');
  }
  return session;
}

/**
 * Require admin role
 */
export async function requireAdmin() {
  await requireAuth();
  const admin = await isAdmin();
  if (!admin) {
    throw new Error('Admin access required');
  }
}

/**
 * Require store role
 */
export async function requireStore() {
  await requireAuth();
  const store = await isStore();
  if (!store) {
    throw new Error('Store access required');
  }
}
