'use client';

import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Bell,
  Heart,
  Home,
  Languages,
  LayoutDashboard,
  LogOut,
  Moon,
  Search,
  Settings,
  SlidersHorizontal,
  Store,
  Sun,
  Tag,
  Ticket,
  User,
} from 'lucide-react';

const COMPARE_STORAGE_KEY = 'compare_products';
const MAX_COMPARE_PRODUCTS = 4;
const subscribe = () => () => {};

interface PublicPageShellProps {
  locale: string;
  children: React.ReactNode;
}

const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export function PublicPageShell({ locale, children }: PublicPageShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const t = useTranslations();
  const { user, signOut, loading: authLoading } = useAuth();
  const [compareCount, setCompareCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  // Keep header search input in sync with URL ?q= param
  // (e.g. when user searches from the search page's own input)
  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);
  const isHydrated = useSyncExternalStore(subscribe, () => true, () => false);

  const isRTL = locale === 'ar';

  const copy = useMemo(
    () =>
      locale === 'ar'
        ? {
            compare: 'المقارنة',
            dashboard: 'لوحة التحكم',
            getStarted: 'ابدأ الآن',
            profile: 'الملف الشخصي',
            wishlist: 'المفضلة',
            priceAlerts: 'تنبيهات الأسعار',
            settings: 'الإعدادات',
            signOut: 'تسجيل الخروج',
          }
        : {
            compare: 'Compare',
            dashboard: 'Dashboard',
            getStarted: 'Get Started',
            profile: 'Profile',
            wishlist: 'Wishlist',
            priceAlerts: 'Price Alerts',
            settings: 'Settings',
            signOut: 'Sign Out',
          },
    [locale]
  );

  /* ── Compare count from localStorage ── */
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
      if (!event.key || event.key === COMPARE_STORAGE_KEY) updateCompareCount();
    };
    const handleCompareUpdate = () => updateCompareCount();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('compare-products-updated', handleCompareUpdate);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('compare-products-updated', handleCompareUpdate);
    };
  }, [pathname]);

  /* ── Navigation links ── */
  const navLinks = [
    { href: `/${locale}`, label: t('common.home'), icon: Home },
    { href: `/${locale}/search`, label: t('button.search'), icon: Search },
    { href: `/${locale}/deals`, label: t('nav.deals'), icon: Tag },
    { href: `/${locale}/stores`, label: t('nav.stores'), icon: Store },
    { href: `/${locale}/coupons`, label: t('nav.coupons'), icon: Ticket },
    ...(user ? [{ href: `/${locale}/dashboard`, label: t('nav.dashboard'), icon: LayoutDashboard }] : []),
  ];

  /* ── User info ── */
  const isFakeEmail = user?.email?.startsWith('phone_') ?? false;
  const userPhone = user?.phone || '';
  const realEmail = isFakeEmail ? '' : (user?.email || '');
  const userName = user?.full_name || (realEmail ? realEmail.split('@')[0] : userPhone) || '';
  const userSubtitle = realEmail || userPhone;
  const userInitials =
    userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  /* ── Locale switch ── */
  const switchLocale = () => {
    const nextLocale = locale === 'ar' ? 'en' : 'ar';
    if (!pathname) { router.push(`/${nextLocale}`); return; }
    const nextPath = pathname.startsWith(`/${locale}`)
      ? pathname.replace(`/${locale}`, `/${nextLocale}`)
      : `/${nextLocale}`;
    router.push(nextPath);
  };

  /* ── Search ── */
  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    router.push(query ? `/${locale}/search?q=${encodeURIComponent(query)}` : `/${locale}/search`);
  };

  /* ── Sign out ── */
  const handleSignOut = async () => {
    await signOut();
    window.location.href = `/${locale}`;
  };

  /* ── URLs ── */
  const compareHref = user ? `/${locale}/compare` : `/${locale}/auth/login?redirect=/compare`;
  const pathWithoutLocale = pathname.startsWith(`/${locale}`)
    ? pathname.slice(locale.length + 1) || '/'
    : pathname || '/';
  const encodedRedirect = encodeURIComponent(pathWithoutLocale);
  const loginHref = `/${locale}/auth/login?redirect=${encodedRedirect}`;
  const signupHref = `/${locale}/auth/signup?redirect=${encodedRedirect}`;

  /* ── Icon button style ── */
  const iconBtnClass =
    'inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100';

  return (
    <div className="min-h-screen bg-surface-container transition-colors duration-300">
      {/* Background gradients */}
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top,rgba(13,71,161,0.10),transparent_62%)] dark:bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.16),transparent_58%)]" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_bottom,rgba(79,70,229,0.08),transparent_64%)] dark:bg-[radial-gradient(circle_at_bottom,rgba(165,180,252,0.14),transparent_60%)]" />

      {/* ═══ Unified Header ═══ */}
      <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/95 backdrop-blur-md dark:border-gray-800/80 dark:bg-gray-950/95">
        <div className="mx-auto w-full max-w-[1900px] px-3 py-3 md:px-6">
          {/* Row 1: Logo | Search (centered) | Actions */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Logo */}
            <Link
              href={`/${locale}`}
              className="group inline-flex shrink-0 items-center gap-2 rounded-xl p-1 transition-colors hover:bg-gray-100/80 dark:hover:bg-gray-800/70"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-extrabold text-on-primary">
                TV
              </span>
              <span className="hidden text-sm font-semibold text-gray-900 dark:text-gray-100 sm:block">
                {t('app.name')}
              </span>
            </Link>

            {/* Search bar — desktop (centered, max-width constrained) */}
            <div className="hidden flex-1 justify-center md:flex">
              <form
                onSubmit={handleSearchSubmit}
                className="flex w-full max-w-lg items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('search.searchPlaceholder')}
                    className="h-8 w-full rounded-lg border border-gray-200 bg-gray-100/80 pe-3 ps-9 text-xs text-gray-900 outline-none transition-colors placeholder:text-gray-500 focus:border-primary-500 focus:bg-white dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100 dark:placeholder:text-gray-400 dark:focus:border-primary-400 dark:focus:bg-gray-900"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-on-primary transition-colors hover:bg-primary-600"
                >
                  <Search className="h-3.5 w-3.5" />
                  {t('button.search')}
                </button>
              </form>
            </div>

            {/* Actions */}
            <div className="ms-auto flex items-center gap-1 md:ms-0 md:gap-1.5">
              {/* Language toggle */}
              <button
                onClick={switchLocale}
                className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                aria-label="Toggle language"
              >
                <Languages className="h-4 w-4" />
                <span className="hidden sm:inline">{locale === 'ar' ? 'EN' : 'AR'}</span>
              </button>

              {/* Theme toggle */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={iconBtnClass}
                aria-label="Toggle theme"
              >
                {isHydrated ? (
                  theme === 'dark' ? (
                    <Sun className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )
                ) : (
                  <span className="h-4 w-4" aria-hidden="true" />
                )}
              </button>

              {authLoading ? (
                <div className="flex items-center gap-1.5">
                  <div className="h-9 w-20 animate-pulse rounded-xl bg-gray-200/90 dark:bg-gray-700/80" />
                  <div className="h-9 w-24 animate-pulse rounded-xl bg-gray-200/90 dark:bg-gray-700/80" />
                </div>
              ) : user ? (
                <>
                  {/* Wishlist */}
                  <Link
                    href={`/${locale}/wishlist`}
                    className={iconBtnClass}
                    aria-label={copy.wishlist}
                  >
                    <Heart className="h-4 w-4" />
                  </Link>

                  {/* Notifications */}
                  <Link
                    href={`/${locale}/notifications`}
                    className={iconBtnClass}
                    aria-label={t('dashboard.sidebar.notifications')}
                  >
                    <Bell className="h-4 w-4" />
                  </Link>

                  {/* User avatar dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="relative rounded-full p-0 transition-opacity hover:opacity-80">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.avatar_url || ''} alt={userName} />
                          <AvatarFallback className="bg-primary-100 text-xs text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                            {userInitials}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {userName}
                          </p>
                          <p className="truncate text-xs text-gray-500 dark:text-gray-400" dir="ltr">
                            {userSubtitle}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href={`/${locale}/dashboard`}>
                          <LayoutDashboard className="me-2 h-4 w-4" />
                          {copy.dashboard}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href={`/${locale}/profile`}>
                          <User className="me-2 h-4 w-4" />
                          {copy.profile}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href={`/${locale}/wishlist`}>
                          <Heart className="me-2 h-4 w-4" />
                          {copy.wishlist}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href={`/${locale}/price-alerts`}>
                          <SlidersHorizontal className="me-2 h-4 w-4" />
                          {copy.priceAlerts}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href={`/${locale}/settings`}>
                          <Settings className="me-2 h-4 w-4" />
                          {copy.settings}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          handleSignOut();
                        }}
                        className="cursor-pointer text-red-600 dark:text-red-400"
                      >
                        <LogOut className="me-2 h-4 w-4" />
                        {copy.signOut}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <div className="flex items-center gap-1.5">
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
                </div>
              )}
            </div>
          </div>

          {/* Search bar — mobile */}
          <form onSubmit={handleSearchSubmit} className="mt-2 flex items-center gap-2 md:hidden">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search.searchPlaceholder')}
                className="h-8 w-full rounded-lg border border-gray-200 bg-gray-100/80 pe-3 ps-9 text-xs text-gray-900 outline-none transition-colors placeholder:text-gray-500 focus:border-primary-500 focus:bg-white dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100 dark:placeholder:text-gray-400 dark:focus:border-primary-400"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-on-primary transition-colors hover:bg-primary-600"
            >
              <Search className="h-3.5 w-3.5" />
              {t('button.search')}
            </button>
          </form>

          {/* Row 2: Nav pills */}
          <nav className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
            {navLinks.map((item) => {
              const isActive =
                item.href === `/${locale}`
                  ? pathname === item.href
                  : isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700/70 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-100'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="ms-auto flex shrink-0 items-center gap-2">
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
            </div>
          </nav>
        </div>
      </header>

      {/* ═══ Content ═══ */}
      <div className="mx-auto max-w-[1900px] px-4 py-6 md:px-6">
        {children}
      </div>
    </div>
  );
}
