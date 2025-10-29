import { createServerClient } from '@supabase/ssr';
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

export async function middleware(request: NextRequest) {
  // First, let next-intl handle the routing
  const response = handleI18nRouting(request);

  // Get the pathname without locale prefix for route matching
  const pathnameWithoutLocale = request.nextUrl.pathname.replace(/^\/(ar|en)/, '') || '/';

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
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Extract current locale from URL
  const locale = request.nextUrl.pathname.split('/')[1];
  const validLocale = locales.includes(locale as any) ? locale : defaultLocale;

  // Redirect to login if accessing protected route without session
  if (isProtectedRoute && !session) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${validLocale}/auth/login`;
    redirectUrl.searchParams.set('redirect', pathnameWithoutLocale);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect to dashboard if accessing auth routes while logged in
  if (isAuthRoute && session) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${validLocale}/dashboard`;
    return NextResponse.redirect(redirectUrl);
  }

  // Check role-based access for admin routes
  if (isAdminRoute && session) {
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (user?.role !== 'admin') {
      // Log unauthorized access attempt
      await createAuditLog({
        user_id: session.user.id,
        action: 'security_alert',
        entity_type: 'admin',
        details: {
          reason: 'unauthorized_admin_access_attempt',
          path: pathnameWithoutLocale,
        },
      });

      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${validLocale}/unauthorized`;
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Check role-based access for store routes
  if (isStoreRoute && session) {
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (user?.role !== 'store' && user?.role !== 'admin') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${validLocale}/unauthorized`;
      return NextResponse.redirect(redirectUrl);
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
