/**
 * API Auth Helper — supports both web (cookies) and mobile (Bearer token)
 *
 * Use these helpers in API routes instead of the cookie-only helpers
 * from server.ts when the route needs to be callable from a mobile app.
 */

import { createClient as createCookieClient } from '@/lib/auth/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/database';
import type { UserRole } from '@/lib/database/types';
import type { User } from '@supabase/supabase-js';

function getConfiguredAdminEmails() {
  return new Set(
    [
      process.env.ADMIN_EMAILS,
      process.env.ADMIN_EMAIL,
      process.env.NEXT_PUBLIC_ADMIN_EMAILS,
    ]
      .filter(Boolean)
      .join(',')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Get authenticated user from an API request.
 * 1. Tries cookie-based auth (web browser)
 * 2. Falls back to Authorization: Bearer <token> (mobile app)
 */
export async function getRequestUser(request: Request): Promise<User | null> {
  // 1. Try cookie-based (web)
  try {
    const supabase = await createCookieClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return user;
  } catch {
    // cookies not available — try Bearer
  }

  // 2. Try Bearer token (mobile)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (user) return user;
  }

  return null;
}

/**
 * Get user profile with role (works for both web + mobile)
 */
export async function getRequestUserProfile(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return null;

  const supabase = createServerClient();
  const { data } = await supabase
    .from('users')
    .select('id, email, phone, full_name, role, avatar_url, preferred_language')
    .eq('id', user.id)
    .maybeSingle();

  if (!data) {
    const isBootstrapAdmin = user.email
      ? getConfiguredAdminEmails().has(user.email.toLowerCase())
      : false;

    return {
      ...user,
      role: (isBootstrapAdmin ? 'admin' : 'customer') as UserRole,
    };
  }

  return {
    ...user,
    ...data,
    role: data.role as UserRole,
  };
}

/**
 * Require auth — throws if not authenticated
 */
export async function requireRequestAuth(request: Request) {
  const user = await getRequestUser(request);
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

/**
 * Require admin — throws if not admin, returns user profile
 */
export async function requireRequestAdmin(request: Request) {
  const profile = await getRequestUserProfile(request);
  if (!profile) {
    throw new Error('Authentication required');
  }
  if (profile.role !== 'admin') {
    throw new Error('Admin access required');
  }
  return profile;
}

/**
 * Require store owner — throws if not store role, returns user profile
 */
export async function requireRequestStore(request: Request) {
  const profile = await getRequestUserProfile(request);
  if (!profile) {
    throw new Error('Authentication required');
  }
  if (profile.role !== 'store' && profile.role !== 'admin') {
    throw new Error('Store access required');
  }
  return profile;
}
