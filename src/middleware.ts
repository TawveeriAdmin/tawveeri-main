import { createServerClient } from '@supabase/ssr';
import type { CookieMethodsServerDeprecated } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createAuditLog } from '@/lib/auth/audit';
import createIntlMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';
import { isNonCanonicalHost, NON_CANONICAL_ROBOTS_TAG } from '@/lib/seo/canonical-host';

/**
 * Combined Middleware: i18n + Auth + API Rate Limiting
 */

// --- Rate Limiting ---
const RATE_WINDOW_MS = 60_000; // 60 seconds
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Cleanup stale entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60_000);

/**
 * Rate-limit buckets.
 *
 * MEASURED DEFECT (2026-07-29): every API route except `/api/search/scrape` shared ONE
 * 30-req/min bucket per IP. `/api/events` — fire-and-forget funnel telemetry — fires
 * twice per page view, so it spent the same budget the customer's search needed. When
 * the bucket emptied, `POST /api/search` returned 429 and the results page rendered
 * ZERO cards with no explanation: it looked like "we have nothing for you", not "try
 * again". Reproduced live: an identical `ps5` request returned 25 products on two runs
 * and 0 on the third, the only difference being `429 /api/search`. This is the root
 * cause of the "intermittent search" the harness kept catching as "no product card
 * found" on a different query each run.
 *
 * It is worse than it looks in Saudi Arabia specifically: mobile carriers NAT large
 * numbers of subscribers behind few egress IPs, so strangers consume each other's
 * budget. Telemetry must never be able to break search, so it gets its own bucket,
 * and search gets a budget sized for a real shopper refining a query.
 */
function bucketOf(pathname: string): 'telemetry' | 'scrape' | 'search' | 'agent' | 'api' {
  if (pathname.startsWith('/api/events') || pathname.startsWith('/api/audit')) return 'telemetry';
  if (pathname.startsWith('/api/search/scrape')) return 'scrape';
  if (pathname.startsWith('/api/search')) return 'search';
  // P2-8: since UNIFIED SEARCH, a need-based query calls the decision engine ALONGSIDE
  // /api/search — it is on the customer's hot path now, not a page they navigate to. Left
  // in the generic `api` bucket it would trade budget against coupons, products, auth and
  // push on a shared carrier IP, which is the identical starvation the telemetry note above
  // records. Worse, an advisor 429 is deliberately SILENT on the unified surface (the
  // results still stand), so the failure would present as "the assistant just doesn't
  // answer for me" — indistinguishable from the capability having been removed.
  if (pathname.startsWith('/api/v1/agent/')) return 'agent';
  return 'api';
}

function getRateLimit(pathname: string): number | null {
  if (pathname.startsWith('/api/cron/')) return null; // authenticated by CRON_SECRET
  if (pathname === '/api/health') return null;
  // Per-instance limits; PM2 runs 2 cluster instances with independent in-process
  // counters, so an IP's effective ceiling is up to 2x these numbers.
  switch (bucketOf(pathname)) {
    case 'telemetry': return 240; // never allowed to starve search; dropping one is harmless
    case 'search':    return 60;  // a shopper refining a query, on a shared carrier IP
    case 'agent':     return 60;  // paired 1:1 with search since P2-8 — same shopper, same budget
    case 'scrape':    return 30;  // heavy live-scrape path, unchanged
    default:          return 30;
  }
}

function checkRateLimit(ip: string, pathname: string): { allowed: boolean; remaining: number; retryAfter?: number } {
  const limit = getRateLimit(pathname);
  if (limit === null) return { allowed: true, remaining: -1 };

  const key = `${ip}:${bucketOf(pathname)}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return { allowed: true, remaining: limit - 1 };
  }

  entry.count++;
  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  return { allowed: true, remaining: limit - entry.count };
}

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

  /**
   * ADR-190 — A DEPLOYMENT DOMAIN IS NOT A SECOND WEBSITE.
   *
   * Railway serves this app on `tawveeri-main-production.up.railway.app` as well as on
   * `tawveeri.com`, and the preview host **is indexed** — a web search for «توفيري» returns it,
   * showing our «المنتج غير موجود» page. Duplicate content splitting the authority of a domain
   * that has very little to split.
   *
   * `noindex` is applied as a HEADER on every response from a non-canonical host, and crawling
   * is deliberately still ALLOWED there. Blocking the crawler in `robots.txt` instead is the
   * classic mistake: a crawler that cannot fetch the page never sees the `noindex`, and the URL
   * stays indexed on anchor text alone. The rule is allow the fetch, refuse the index.
   *
   * Applied first, before every other branch, so it is on API responses, redirects and rate-limit
   * rejections too — a header that only some responses carry is a header that leaks.
   */
  const nonCanonical = isNonCanonicalHost(request.headers.get('host'));
  const markHost = <T extends NextResponse>(res: T): T => {
    if (nonCanonical) res.headers.set('X-Robots-Tag', NON_CANONICAL_ROBOTS_TAG);
    return res;
  };

  // API routes: apply rate limiting, then pass through
  if (pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const { allowed, remaining, retryAfter } = checkRateLimit(ip, pathname);

    if (!allowed) {
      return markHost(NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Remaining': '0',
          },
        }
      ));
    }

    const response = markHost(NextResponse.next());
    if (remaining >= 0) {
      response.headers.set('X-RateLimit-Remaining', String(remaining));
    }
    return response;
  }

  // مسارات تقنية locale-independent — تتجاوز i18n والمصادقة:
  // /go (redirect layer) + sitemap.xml + robots.txt
  if (
    pathname.startsWith('/go/') ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt'
  ) {
    return markHost(NextResponse.next());
  }

  // First, let next-intl handle the routing
  const response = markHost(handleI18nRouting(request));

  // THE ROOT LAYOUT READS THIS. `src/app/layout.tsx` sits above the `[locale]` segment and has
  // no route param, so the locale it puts in `<html lang>`/`<html dir>` — and the messages it
  // loads — come from here. next-intl also publishes `x-next-intl-locale`, which the root layout
  // keeps as a fallback; this header exists so the contract is OURS and does not depend on a
  // library internal surviving an upgrade. Set on EVERY page response, before the early return
  // for unprotected routes, because the shell is on every page. Same mechanism as `x-pathname`
  // below (already relied on by the dashboard layout).
  const requestLocale = pathname.split('/')[1];
  response.headers.set(
    'x-locale',
    locales.includes(requestLocale as (typeof locales)[number]) ? requestLocale : defaultLocale,
  );

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
    const redirectResponse = markHost(NextResponse.redirect(url));
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

  // Redirect after login. Admins land on the Founder Command Center (ADR-216) — the
  // founder's daily-use screen — not the legacy admin dashboard. Customer routing unchanged.
  if (isAuthRoute && user) {
    const role = await getUserRole();
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname =
      role === 'admin'
        ? `/${validLocale}/admin/command-center`
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

  // Pass current pathname to server components via header
  response.headers.set('x-pathname', pathnameWithoutLocale);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - go (redirect layer — locale-independent)
     * - sitemap.xml / robots.txt (SEO files — locale-independent)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico / sw.js (root static files — sw.js must serve at origin root
     *   or service-worker registration fails; a locale redirect here silently
     *   broke web push for every browser)
     * - public folder static assets by extension (video/audio included — the
     *   growth creatives under /growth/*.mp4 are served from public/)
     */
    '/((?!go/|sitemap.xml|robots.txt|_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|mp3)$).*)',
  ],
};