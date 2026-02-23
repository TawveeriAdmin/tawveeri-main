import { createServerClient } from '@supabase/ssr';
import type { CookieMethodsServerDeprecated } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createAuditLog } from '@/lib/auth/audit';
import createIntlMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';

/**
 * Combined Middleware: i18n + Auth
 * Handles locale routing and authentication/authorization
 */

// Routes that require authentication (without locale prefix)
const protectedRoutes = [
  '/dashboard',
  '/profile',
  '/wishlist',
  '/notifications',
  '/price-alerts',
  '/settings',
];

// Routes that require admin role
const adminRoutes = ['/admin'];

// Routes that require store role
const storeRoutes = ['/store/dashboard', '/store/products', '/store/analytics'];

// Public routes that should redirect if already authenticated
const authRoutes = ['/auth/login', '/auth/signup'];

// Create the intl middleware
const handleI18nRouting = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

const getConfiguredAdminEmails = (() => {
  let cached: Set<string> | null = null;

  return () => {
    if (cached) return cached;

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

    if (parsed.length === 0) {
      parsed.push('jfr3sam@gmail.com');
    }

    cached = new Set(parsed);
    return cached;
  };
})();

const isConfiguredAdminEmail = (email?: string | null) => {
  if (!email) return false;
  return getConfiguredAdminEmails().has(email.trim().toLowerCase());
};

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip middleware for API routes
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // First, let next-intl handle the routing
  const response = handleI18nRouting(request);

  // Get the pathname without locale prefix for route matching
  const pathnameWithoutLocale = pathname.replace(/^\/(ar|en)/, '') || '/';

  // Check if route requires authentication
  const isProtectedRoute = protectedRoutes.some((route) => pathnameWithoutLocale.startsWith(route));
  const isAdminRoute = adminRoutes.some((route) => pathnameWithoutLocale.startsWith(route));
  const isStoreRoute = storeRoutes.some((route) => pathnameWithoutLocale.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathnameWithoutLocale.startsWith(route));

  // If not a protected route, return intl response
  if (!isProtectedRoute && !isAdminRoute && !isStoreRoute && !isAuthRoute) {
    return response;
  }

  // For protected routes, add auth checks
  const cookies: CookieMethodsServerDeprecated = {
    get(name: string) {
      return request.cookies.get(name)?.value;
    },
    set(name: string, value: string, options = {}) {
      response.cookies.set(name, value, options);
    },
    remove(name: string, options = {}) {
      response.cookies.set(name, '', { ...options, maxAge: 0 });
    },
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies,
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isBootstrapAdmin = isConfiguredAdminEmail(user?.email ?? null);

  let userRole: string | null | undefined;
  const getUserRole = async (): Promise<string | null> => {
    if (!user) return null;
    if (isBootstrapAdmin) return 'admin';
    if (userRole !== undefined) return userRole;

    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    userRole = data?.role ?? null;
    if (userRole !== 'admin' && isBootstrapAdmin) {
      userRole = 'admin';
    }
    return userRole ?? null;
  };

  // Helper: create a redirect that preserves auth cookies set by Supabase SSR
  // (e.g. refreshed access tokens). Without this, token refreshes done in the
  // middleware are lost and the browser client cannot establish a session.
  const createRedirect = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  };

  // Extract current locale from URL
  const locale = request.nextUrl.pathname.split('/')[1];
  const validLocale = locales.includes(locale as (typeof locales)[number]) ? locale : defaultLocale;

  // Redirect to login if accessing protected route without user
  if (isProtectedRoute && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${validLocale}/auth/login`;
    redirectUrl.searchParams.set('redirect', pathnameWithoutLocale);
    return createRedirect(redirectUrl);
  }

  // Redirect to dashboard if accessing auth routes while logged in
  if (isAuthRoute && user) {
    const role = await getUserRole();
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname =
      role === 'admin'
        ? `/${validLocale}/admin/dashboard`
        : `/${validLocale}/dashboard`;
    return createRedirect(redirectUrl);
  }

  // Check role-based access for admin routes
  if (isAdminRoute && user) {
    const role = await getUserRole();

    if (role !== 'admin') {
      // Log unauthorized access attempt
      await createAuditLog({
        user_id: user.id,
        action: 'security_alert',
        entity_type: 'admin',
        details: {
          reason: 'unauthorized_admin_access_attempt',
          path: pathnameWithoutLocale,
        },
      });

      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${validLocale}/unauthorized`;
      return createRedirect(redirectUrl);
    }
  }

  // Check role-based access for store routes
  if (isStoreRoute && user) {
    const role = await getUserRole();

    if (role !== 'store' && role !== 'admin') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${validLocale}/unauthorized`;
      return createRedirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
