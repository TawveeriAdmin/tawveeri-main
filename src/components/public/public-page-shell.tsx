'use client';

import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
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
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CookingPot,
  Gamepad2,
  Globe,
  Headphones,
  Heart,
  Home,
  Laptop,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Monitor,
  Moon,
  Package,
  Printer,
  Refrigerator,
  Search,
  SlidersHorizontal,
  Smartphone,
  Sparkle,
  Store,
  Sun,
  Tablet,
  Tag,
  Ticket,
  Tv,
  User,
  WashingMachine,
  Watch,
  Wifi,
} from 'lucide-react';
import Image from 'next/image';
import { SearchVoiceBarcodeActions } from '@/components/search/search-voice-barcode-actions';
import { Footer } from '@/components/layout/footer';
import { CompareFloatingBar } from '@/components/compare/compare-floating-bar';

const subscribe = () => () => {};

/**
 * Categories surfaced inside the header's "Categories" dropdown. This is the
 * complete taxonomy we support — keep it in sync with CATEGORY_META in the
 * landing client. Slugs match the product_category enum values.
 */
const HEADER_CATEGORIES: Array<{ slug: string; icon: typeof Smartphone; labelAr: string; labelEn: string }> = [
  { slug: 'smartphone',    icon: Smartphone,     labelAr: 'الهواتف',              labelEn: 'Phones' },
  { slug: 'laptop',        icon: Laptop,         labelAr: 'اللابتوبات',           labelEn: 'Laptops' },
  { slug: 'tablet',        icon: Tablet,         labelAr: 'الأجهزة اللوحية',      labelEn: 'Tablets' },
  { slug: 'tv',            icon: Tv,             labelAr: 'التلفزيونات',          labelEn: 'TVs' },
  { slug: 'audio',         icon: Headphones,     labelAr: 'الصوتيات',             labelEn: 'Audio' },
  { slug: 'gaming',        icon: Gamepad2,       labelAr: 'الألعاب',              labelEn: 'Gaming' },
  { slug: 'camera',        icon: Camera,         labelAr: 'الكاميرات',            labelEn: 'Cameras' },
  { slug: 'monitor',       icon: Monitor,        labelAr: 'الشاشات',              labelEn: 'Monitors' },
  { slug: 'wearable',      icon: Watch,          labelAr: 'الساعات الذكية',       labelEn: 'Wearables' },
  { slug: 'networking',    icon: Wifi,           labelAr: 'الشبكات',              labelEn: 'Networking' },
  { slug: 'smart_home',    icon: Home,           labelAr: 'المنزل الذكي',         labelEn: 'Smart Home' },
  { slug: 'printer',       icon: Printer,        labelAr: 'الطابعات',             labelEn: 'Printers' },
  { slug: 'appliance',     icon: WashingMachine, labelAr: 'الأجهزة المنزلية',     labelEn: 'Appliances' },
  { slug: 'refrigerator',  icon: Refrigerator,   labelAr: 'الثلاجات',             labelEn: 'Fridges' },
  { slug: 'kitchen',       icon: CookingPot,     labelAr: 'المطبخ',               labelEn: 'Kitchen' },
  { slug: 'personal_care', icon: Sparkle,        labelAr: 'العناية الشخصية',      labelEn: 'Personal Care' },
  { slug: 'accessories',   icon: Package,        labelAr: 'الإكسسوارات',          labelEn: 'Accessories' },
];

/** Top categories exposed directly as quick-links in the header's nav row.
 *  Rakhys-style: 4-5 most-searched categories surfaced inline after the
 *  Categories dropdown for one-click access. */
const HEADER_QUICK_CATEGORIES: string[] = ['smartphone', 'laptop', 'tv', 'audio', 'appliance'];

interface PublicPageShellProps {
  locale: string;
  children: React.ReactNode;
  /** When true, `main` is rendered without the shell's container padding — used by the landing for full-bleed sections. */
  fullBleed?: boolean;
}

const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export function PublicPageShell({ locale, children, fullBleed = false }: PublicPageShellProps) {
  const pathname = usePathname();
  // The landing page already renders a prominent hero search — suppress the
  // header search on that route so the client doesn't see two bars.
  const isLandingPage = pathname === `/${locale}` || pathname === `/${locale}/`;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const t = useTranslations();
  const { user, signOut, loading: authLoading } = useAuth();
  const [wishlistCount, setWishlistCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
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
            savedSearches: 'عمليات البحث المحفوظة',
            signOut: 'تسجيل الخروج',
          }
        : {
            compare: 'Compare',
            dashboard: 'Dashboard',
            getStarted: 'Get Started',
            profile: 'Profile',
            wishlist: 'Wishlist',
            priceAlerts: 'Price Alerts',
            savedSearches: 'Saved Searches',
            signOut: 'Sign Out',
          },
    [locale]
  );

  /* ── Wishlist count from Supabase ── */
  useEffect(() => {
    if (!user) { setWishlistCount(0); return; }

    const supabase = getSupabaseBrowserClient();
    const fetchCount = async () => {
      const { count } = await supabase
        .from('user_wishlists')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      setWishlistCount(count ?? 0);
    };
    fetchCount();

    const handleWishlistUpdate = () => fetchCount();
    window.addEventListener('wishlist-updated', handleWishlistUpdate);
    return () => window.removeEventListener('wishlist-updated', handleWishlistUpdate);
  }, [user, pathname]);

  /* ── Unread notification count from Supabase ── */
  useEffect(() => {
    if (!user) { setNotificationCount(0); return; }

    const supabase = getSupabaseBrowserClient();
    const fetchCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setNotificationCount(count ?? 0);
    };
    fetchCount();

    const handleUpdate = () => fetchCount();
    window.addEventListener('notifications-updated', handleUpdate);
    return () => window.removeEventListener('notifications-updated', handleUpdate);
  }, [user, pathname]);

  /* ── Primary section links + quick-category shortcuts ──
     Categories themselves live in the dropdown next to these links. This
     list is the flat secondary nav: Stores / Deals / Coupons, then a handful
     of top categories surfaced inline for one-click browsing. */
  const quickNavLinks: Array<{
    href: string;
    label: string;
    icon?: typeof Store;
  }> = [
    { href: `/${locale}/stores`, label: t('nav.stores'), icon: Store },
    { href: `/${locale}/deals`, label: t('nav.deals'), icon: Tag },
    { href: `/${locale}/coupons`, label: t('nav.coupons'), icon: Ticket },
    ...HEADER_QUICK_CATEGORIES.map((slug) => {
      const meta = HEADER_CATEGORIES.find((c) => c.slug === slug);
      return meta
        ? {
            href: `/${locale}/search?category=${slug}`,
            label: isRTL ? meta.labelAr : meta.labelEn,
            icon: meta.icon,
          }
        : null;
    }).filter((x): x is { href: string; label: string; icon: typeof Store } => x !== null),
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
  const goToLocale = (target: string) => {
    if (target === locale) return;
    if (!pathname) { router.push(`/${target}`); return; }
    const nextPath = pathname.startsWith(`/${locale}`)
      ? pathname.replace(`/${locale}`, `/${target}`)
      : `/${target}`;
    router.push(nextPath);
  };

  /* ── Search ── */
  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    router.push(query ? `/${locale}/search?q=${encodeURIComponent(query)}` : `/${locale}/search`);
  };

  const applyQueryFromVoiceOrBarcode = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSearchQuery(trimmed);
    router.push(`/${locale}/search?q=${encodeURIComponent(trimmed)}`);
  };

  /* ── Sign out ── */
  const handleSignOut = async () => {
    await signOut();
    window.location.href = `/${locale}`;
  };

  /* ── URLs ── */
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
    <div className="min-h-screen bg-[color:var(--color-surface)] transition-colors duration-300">
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-primary focus:shadow-lg"
      >
        {locale === 'ar' ? 'تخطي إلى المحتوى الرئيسي' : 'Skip to main content'}
      </a>

      {/* Background gradients */}
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top,rgba(13,71,161,0.10),transparent_62%)] dark:bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.16),transparent_58%)]" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_bottom,rgba(79,70,229,0.08),transparent_64%)] dark:bg-[radial-gradient(circle_at_bottom,rgba(165,180,252,0.14),transparent_60%)]" />

      {/* ═══ Unified Header ═══ */}
      <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/95 backdrop-blur-md dark:border-gray-800/80 dark:bg-gray-950/95">
        <div className="mx-auto w-full max-w-[1600px] px-3 py-3 md:px-6">
          {/* Row 1: Logo | Search (centered) | Actions */}
          <div className="flex items-center justify-between gap-2 md:gap-3">
            {/* Logo — image + stacked name & tagline so first-time visitors
                see what the site does in one glance. Tagline stays hidden on
                narrow viewports to avoid crowding the action cluster. */}
            <Link
              href={`/${locale}`}
              aria-label={t('app.name')}
              className="group inline-flex shrink-0 items-center gap-2.5 rounded-xl p-1 transition-colors hover:bg-gray-100/80 dark:hover:bg-gray-800/70"
            >
              <Image
                src="/logos/Tawveeri.png"
                alt="Tawveeri"
                width={32}
                height={32}
                className="h-8 w-8 rounded-lg object-contain"
              />
              <span className="hidden flex-col leading-tight sm:flex">
                <span className="text-sm font-bold text-on-surface">
                  {t('app.name')}
                </span>
                <span className="hidden text-[10px] font-medium text-on-surface-variant lg:block">
                  {isRTL
                    ? 'قارن أسعار الإلكترونيات في السعودية'
                    : 'Compare electronics prices in Saudi Arabia'}
                </span>
              </span>
            </Link>

            {/* Prominent search bar — desktop.
                Structure matches the cleaner Rakhys-style pill: one search
                icon absolutely-positioned inside the input at the logical
                start, the input itself, a trailing voice/barcode pair, then
                a large green submit button at the end. Taller (h-12), wider
                max-width, and a stronger border so the pill dominates the
                header row visually. */}
            <div className="hidden flex-1 justify-center md:flex">
              <form
                onSubmit={handleSearchSubmit}
                className="relative flex h-12 w-full max-w-4xl items-stretch overflow-hidden rounded-full border-2 border-outline-variant bg-surface-container-lowest transition-colors focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15"
              >
                <Search
                  aria-hidden
                  className="pointer-events-none absolute start-5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
                />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('search.searchPlaceholder')}
                  aria-label={t('search.searchPlaceholder')}
                  className="min-w-0 flex-1 bg-transparent ps-12 pe-3 text-[14px] text-on-surface placeholder:text-on-surface-variant/70 outline-none"
                />
                <div className="flex shrink-0 items-center pe-1">
                  <SearchVoiceBarcodeActions
                    locale={locale}
                    onQuery={applyQueryFromVoiceOrBarcode}
                    compact
                  />
                </div>
                <button
                  type="submit"
                  aria-label={t('button.search')}
                  className="inline-flex h-full w-16 shrink-0 items-center justify-center bg-primary text-on-primary transition-colors hover:bg-primary-600"
                >
                  <Search className="h-5 w-5" strokeWidth={2.25} />
                </button>
              </form>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 md:gap-1.5">
              {/* Language — compact single icon-button. Shows a globe and
                  the *target* language code (i.e. the one you'd switch to),
                  so the meaning reads "click to switch to EN" in Arabic mode
                  and vice versa. Toggles on click. */}
              <button
                type="button"
                onClick={() => goToLocale(locale === 'ar' ? 'en' : 'ar')}
                aria-label={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              >
                <Globe className="h-4 w-4" strokeWidth={2} />
                <span className="tracking-wide">{locale === 'ar' ? 'EN' : 'AR'}</span>
              </button>

              {/* Theme — single icon toggle. Shows the *target* state
                  (moon in light mode = "click for dark", sun in dark mode
                  = "click for light") — GitHub/Vercel convention.
                  Pre-hydration we render a transparent placeholder so the
                  server HTML doesn't mismatch after next-themes reads
                  localStorage on mount. */}
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={isHydrated && theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              >
                {isHydrated ? (
                  theme === 'dark' ? (
                    <Sun className="h-4 w-4 text-amber-500" strokeWidth={2} />
                  ) : (
                    <Moon className="h-4 w-4" strokeWidth={2} />
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
                    className={cn(iconBtnClass, 'relative')}
                    aria-label={copy.wishlist}
                  >
                    <Heart className="h-4 w-4" />
                    {wishlistCount > 0 && (
                      <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {wishlistCount > 99 ? '99+' : wishlistCount}
                      </span>
                    )}
                  </Link>

                  {/* Notifications */}
                  <Link
                    href={`/${locale}/notifications`}
                    className={cn(iconBtnClass, 'relative')}
                    aria-label={t('dashboard.sidebar.notifications')}
                  >
                    <Bell className="h-4 w-4" />
                    {notificationCount > 0 && (
                      <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {notificationCount > 99 ? '99+' : notificationCount}
                      </span>
                    )}
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
                    <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-56" dir={isRTL ? 'rtl' : 'ltr'}>
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
                        <Link href={`/${locale}/saved-searches`}>
                          <Search className="me-2 h-4 w-4" />
                          {copy.savedSearches}
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

          {/* Search bar — mobile. Mirrors the desktop pill structure:
              start-aligned search icon inside the input, trailing voice/
              barcode cluster, distinct green submit button at the end. */}
          <form
            onSubmit={handleSearchSubmit}
            className="relative mt-3 flex h-11 items-stretch overflow-hidden rounded-full border-2 border-outline-variant bg-surface-container-lowest transition-colors focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 md:hidden"
          >
            <Search
              aria-hidden
              className="pointer-events-none absolute start-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant"
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search.searchPlaceholder')}
              aria-label={t('search.searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent ps-10 pe-2 text-[13px] text-on-surface placeholder:text-on-surface-variant/70 outline-none"
            />
            <div className="flex shrink-0 items-center">
              <SearchVoiceBarcodeActions
                locale={locale}
                onQuery={applyQueryFromVoiceOrBarcode}
                compact
              />
            </div>
            <button
              type="submit"
              aria-label={t('button.search')}
              className="inline-flex h-full w-12 shrink-0 items-center justify-center bg-primary text-on-primary transition-colors hover:bg-primary-600"
            >
              <Search className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </form>

          {/* Row 2: Categories mega-dropdown + Stores + top-category quick-links */}
          <nav className="mt-3 flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Categories dropdown — opens a grid of every supported category */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-primary px-3.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-600"
                >
                  <LayoutGrid className="h-4 w-4" strokeWidth={2.25} />
                  {isRTL ? 'الفئات' : 'Categories'}
                  {isRTL ? <ChevronDown className="h-3.5 w-3.5 opacity-80" /> : <ChevronDown className="h-3.5 w-3.5 opacity-80" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align={isRTL ? 'end' : 'start'}
                className="w-[min(560px,90vw)] p-3"
              >
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {HEADER_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <DropdownMenuItem key={cat.slug} asChild className="cursor-pointer">
                        <Link
                          href={`/${locale}/search?category=${cat.slug}`}
                          className="flex items-center gap-2.5 rounded-md px-2.5 py-2"
                        >
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary-50 text-primary-700">
                            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </span>
                          <span className="text-sm">
                            {isRTL ? cat.labelAr : cat.labelEn}
                          </span>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </div>
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link
                    href={`/${locale}/search`}
                    className="flex items-center justify-between px-2.5 py-2 text-sm font-semibold text-primary-700"
                  >
                    {isRTL ? 'تصفّح كل المنتجات' : 'Browse all products'}
                    {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Divider */}
            <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-outline-variant" />

            {/* Section links + top-category quick-links. Secondary nav —
                active state gets a primary-tinted chip, inactive is plain. */}
            {quickNavLinks.map((item) => {
              const isActive =
                item.href === `/${locale}`
                  ? pathname === item.href
                  : isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
                  )}
                >
                  {item.icon && <item.icon className="h-3.5 w-3.5" strokeWidth={1.75} />}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ═══ Content ═══ */}
      <main
        id="main-content"
        className={
          fullBleed
            ? 'pb-24'
            : 'mx-auto max-w-[1600px] px-4 py-6 pb-24 md:px-8'
        }
      >
        {children}
      </main>

      <Footer />

      {/* Persistent compare tray — visible on every page when the list has items */}
      <CompareFloatingBar locale={locale} />
    </div>
  );
}

/**
 * Compact segmented toggle. Shows every option at once; the active one gets
 * a solid primary fill and inactive ones stay text-only. No opacity modifiers
 * (this project's Tailwind setup misbehaves with `/N` suffixes on colors),
 * no absolute-positioned indicator — just solid semantic tokens.
 *
 * `value` is optional so the caller can render the toggle before client-only
 * state (e.g. next-themes' current theme) has resolved. When undefined, no
 * button is marked active.
 */
type SegmentOption = {
  value: string;
  label?: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
};

function SegmentedToggle({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegmentOption[];
  value: string | undefined;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex h-9 items-center gap-0.5 rounded-xl border border-outline-variant bg-surface-container-low p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.ariaLabel || opt.label || opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex h-7 min-w-8 items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-semibold uppercase tracking-wide transition-colors duration-150',
              active
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
            )}
          >
            {opt.icon}
            {opt.label && <span>{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
