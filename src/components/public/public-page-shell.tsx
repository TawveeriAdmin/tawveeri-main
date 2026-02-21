'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Home,
  PackageSearch,
  Search,
  Store,
  Tag,
  Ticket,
  User,
} from 'lucide-react';

const COMPARE_STORAGE_KEY = 'compare_products';
const MAX_COMPARE_PRODUCTS = 4;

interface PublicPageShellProps {
  locale: string;
  children: React.ReactNode;
}

const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export function PublicPageShell({ locale, children }: PublicPageShellProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const { user } = useAuth();
  const [compareCount, setCompareCount] = useState(0);

  const copy = useMemo(
    () =>
      locale === 'ar'
        ? {
            compare: 'المقارنة',
            dashboard: 'لوحة التحكم',
            getStarted: 'ابدأ الآن',
          }
        : {
            compare: 'Compare',
            dashboard: 'Dashboard',
            getStarted: 'Get Started',
          },
    [locale]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateCompareCount = () => {
      try {
        const stored = window.localStorage.getItem(COMPARE_STORAGE_KEY);
        const ids: string[] = stored ? JSON.parse(stored) : [];
        setCompareCount(Array.from(new Set(ids)).slice(0, MAX_COMPARE_PRODUCTS).length);
      } catch {
        setCompareCount(0);
      }
    };

    updateCompareCount();

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === COMPARE_STORAGE_KEY) {
        updateCompareCount();
      }
    };

    const handleCompareUpdate = () => updateCompareCount();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('compare-products-updated', handleCompareUpdate);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('compare-products-updated', handleCompareUpdate);
    };
  }, [pathname]);

  const navLinks = [
    { href: `/${locale}`, label: t('common.home'), icon: Home },
    { href: `/${locale}/products`, label: t('nav.products'), icon: PackageSearch },
    { href: `/${locale}/deals`, label: t('nav.deals'), icon: Tag },
    { href: `/${locale}/coupons`, label: t('nav.coupons'), icon: Ticket },
    { href: `/${locale}/stores`, label: t('nav.stores'), icon: Store },
    { href: `/${locale}/search`, label: t('button.search'), icon: Search },
  ];
  const navLinksWithState = navLinks.map((item) => ({
    ...item,
    isActive:
      item.href === `/${locale}`
        ? pathname === item.href
        : isActivePath(pathname, item.href),
  }));

  const compareHref = user
    ? `/${locale}/compare`
    : `/${locale}/auth/login?redirect=/compare`;
  const pathWithoutLocale = pathname.startsWith(`/${locale}`)
    ? pathname.slice(locale.length + 1) || '/'
    : pathname || '/';
  const encodedRedirect = encodeURIComponent(pathWithoutLocale);
  const loginHref = `/${locale}/auth/login?redirect=${encodedRedirect}`;
  const signupHref = `/${locale}/auth/signup?redirect=${encodedRedirect}`;

  return (
    <div className="min-h-screen bg-surface-container transition-colors duration-300">
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top,rgba(13,71,161,0.10),transparent_62%)] dark:bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.16),transparent_58%)]" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_bottom,rgba(79,70,229,0.08),transparent_64%)] dark:bg-[radial-gradient(circle_at_bottom,rgba(165,180,252,0.14),transparent_60%)]" />

      <div className="container mx-auto max-w-[1900px] px-4 py-6 md:py-8">
        <div className="sticky top-3 z-30 mb-6 rounded-2xl border border-gray-200 bg-white/90 p-2 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/85">
          <div className="flex flex-wrap items-center gap-2">
            {navLinksWithState.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors',
                  item.isActive
                    ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-100'
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            ))}

            <div className="ms-auto flex items-center gap-2">
              <Link
                href={compareHref}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-700/70 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
              >
                <BarChart3 className="h-4 w-4" />
                <span>{copy.compare}</span>
                <Badge className="border-0 bg-amber-200 px-1.5 py-0 text-[10px] text-amber-900 dark:bg-amber-700/60 dark:text-amber-100">
                  {compareCount}/{MAX_COMPARE_PRODUCTS}
                </Badge>
              </Link>

              {user ? (
                <Link
                  href={`/${locale}/dashboard`}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-100"
                >
                  <User className="h-4 w-4" />
                  <span>{copy.dashboard}</span>
                </Link>
              ) : (
                <>
                  <Link
                    href={loginHref}
                    className="inline-flex h-9 items-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-100"
                  >
                    {t('common.login')}
                  </Link>
                  <Link
                    href={signupHref}
                    className="inline-flex h-9 items-center rounded-xl border border-primary-300 bg-primary-50 px-3 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/45"
                  >
                    {copy.getStarted}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
