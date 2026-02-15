/**
 * Server-side Auth Utilities
 * For use in Server Components and API routes
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';

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
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Cookie setting can fail in Server Components
            // This is fine during the render phase
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Cookie removal can fail in Server Components
          }
        },
      },
    }
  );
});

/**
 * Get current session on server
 */
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * Get current user on server
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Get user profile with role from database
 */
export async function getUserProfile() {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return { ...user, ...data };
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
