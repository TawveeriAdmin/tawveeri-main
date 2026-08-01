'use client';

import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
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
  Bell, Camera, ChevronDown, ChevronLeft, ChevronRight,
  CookingPot, Gamepad2, Globe, Headphones, Heart, Home,
  Laptop, LayoutDashboard, LayoutGrid, LogOut, Monitor, Moon,
  Package, Printer, Refrigerator, Search, SlidersHorizontal,
  Smartphone, Sparkle, Store, Sun, Tablet, Tag, Ticket, Tv,
  User, WashingMachine, Watch, Wifi,
} from 'lucide-react';
import Image from 'next/image';
import { SearchVoiceBarcodeActions } from '@/components/search/search-voice-barcode-actions';
import { SearchAutocomplete } from '@/components/search/search-autocomplete';
import { Footer } from '@/components/layout/footer';
import { useNavigableCategories } from '@/lib/intelligence/navigable-categories-context';
import { navigateToLocale } from '@/lib/i18n/switch-locale';
import { CompareFloatingBar } from '@/components/compare/compare-floating-bar';

const subscribe = () => () => {};

// The hardcoded HEADER_CATEGORIES list that stood here was removed under ADR-150. Eight of its
// seventeen entries (gaming, wearable, networking, smart_home, appliance, kitchen,
// personal_care, accessories) matched NO category production holds, and `camera` holds 3
// comparable products. Every one of them was a promoted dead end.

// Icons only, keyed by the TPS category as stored in production. This map decides NOTHING
// about which categories are shown — that is derived live (ADR-150). An unmapped category
// falls back to a generic icon rather than being hidden.
const HEADER_CATEGORY_ICONS: Record<string, typeof Smartphone> = {
  air_conditioner: Wifi,
  mobile: Smartphone,
  washing_machine: WashingMachine,
  tv: Tv,
  laptop: Laptop,
  tablet: Tablet,
  monitor: Monitor,
  refrigerator: Refrigerator,
  audio: Headphones,
  smartwatch: Watch,
  dishwasher: CookingPot,
  printer: Printer,
  vacuum: Home,
  air_fryer: CookingPot,
  microwave: CookingPot,
  camera: Camera,
};

// Legacy `?category=<slug>` URLs (external links, bookmarks) still need to fill the search
// box. Resolved against the live list rather than a parallel hardcoded one.
const getHeaderCategoryLabel = (
  slug: string | null,
  isRTL: boolean,
  cats: Array<{ key: string; slug: string; labelAr: string; labelEn: string }>,
) => {
  if (!slug) return '';
  const category = cats.find((item) => item.slug === slug || item.key === slug);
  if (!category) return '';
  return isRTL ? category.labelAr : category.labelEn;
};

interface PublicPageShellProps {
  locale: string;
  children: React.ReactNode;
  fullBleed?: boolean;
}

const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export function PublicPageShell({ locale, children, fullBleed = false }: PublicPageShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const t = useTranslations();
  const { user, signOut, loading: authLoading } = useAuth();
  const [wishlistCount, setWishlistCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const isRTL = locale === 'ar';
  // Live-derived (ADR-150), supplied by the locale layout. Empty when the measurement failed —
  // the menu then hides rather than showing a stale list.
  const navigableCategories = useNavigableCategories();
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get('q') || getHeaderCategoryLabel(searchParams.get('category'), isRTL, navigableCategories)
  );

  useEffect(() => {
    queueMicrotask(() => {
      setSearchQuery(searchParams.get('q') || getHeaderCategoryLabel(searchParams.get('category'), isRTL, navigableCategories));
    });
  }, [searchParams, isRTL, navigableCategories]);

  const isHydrated = useSyncExternalStore(subscribe, () => true, () => false);

  const copy = useMemo(
    () =>
      locale === 'ar'
        ? {
            compare: 'المقارنة', dashboard: 'لوحة التحكم', getStarted: 'ابدأ الآن',
            profile: 'الملف الشخصي', wishlist: 'المفضلة', priceAlerts: 'تنبيهات الأسعار',
            savedSearches: 'عمليات البحث المحفوظة', signOut: 'تسجيل الخروج',
          }
        : {
            compare: 'Compare', dashboard: 'Dashboard', getStarted: 'Get Started',
            profile: 'Profile', wishlist: 'Wishlist', priceAlerts: 'Price Alerts',
            savedSearches: 'Saved Searches', signOut: 'Sign Out',
          },
    [locale]
  );

  useEffect(() => {
    if (!user) { queueMicrotask(() => setWishlistCount(0)); return; }
    const supabase = getSupabaseBrowserClient();
    const fetchCount = async () => {
      const { count } = await supabase.from('user_wishlists').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      setWishlistCount(count ?? 0);
    };
    fetchCount();
    const handleWishlistUpdate = () => fetchCount();
    window.addEventListener('wishlist-updated', handleWishlistUpdate);
    return () => window.removeEventListener('wishlist-updated', handleWishlistUpdate);
  }, [user, pathname]);

  useEffect(() => {
    if (!user) { queueMicrotask(() => setNotificationCount(0)); return; }
    const supabase = getSupabaseBrowserClient();
    const fetchCount = async () => {
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false);
      setNotificationCount(count ?? 0);
    };
    fetchCount();
    const handleUpdate = () => fetchCount();
    window.addEventListener('notifications-updated', handleUpdate);
    return () => window.removeEventListener('notifications-updated', handleUpdate);
  }, [user, pathname]);

  // Calm nav (Rakhs IA principle: one purpose per screen, few competing options). Trimmed from 11
  // items to 4 core destinations. Categories moved to the homepage as scannable cards; Price-Truth
  // surfaced as a homepage trust strip — each is reachable where it belongs, not stacked in the nav.
  // P2-8 · UNIFIED SEARCH. «وفّر» used to sit here as its own destination, which meant the
  // header asked the customer to decide between "search" and "assistant" before they had
  // described anything — the exact choice the Constitution says they must never be handed
  // ("Customers never choose between search · AI search · assistant"). The capability did
  // not go anywhere: the search box now routes need-based queries to the same reasoning
  // engine and renders the same answer component, and `/advisor` redirects into it.
  const quickNavLinks: Array<{ href: string; label: string; icon?: typeof Store }> = [
    { href: `/${locale}/stores`, label: t('nav.stores'), icon: Store },
    { href: `/${locale}/deals`, label: t('nav.deals'), icon: Tag },
    { href: `/${locale}/coupons`, label: t('nav.coupons'), icon: Ticket },
  ];

  const isFakeEmail = user?.email?.startsWith('phone_') ?? false;
  const userPhone = user?.phone || '';
  const realEmail = isFakeEmail ? '' : (user?.email || '');
  const userName = user?.full_name || (realEmail ? realEmail.split('@')[0] : userPhone) || '';
  const userFirstName = userName.trim().split(/\s+/)[0] || userName;
  const userSubtitle = realEmail || userPhone;
  const userInitials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  // A DOCUMENT LOAD, deliberately — see `navigateToLocale` for why a `router.push` here leaves
  // the document's language, direction and messages on the previous locale without failing.
  const goToLocale = (target: string) => navigateToLocale(locale, target, pathname);

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

  const handleSignOut = async () => {
    await signOut();
    window.location.href = `/${locale}`;
  };

  const pathWithoutLocale = pathname.startsWith(`/${locale}`) ? pathname.slice(locale.length + 1) || '/' : pathname || '/';
  // The homepage owns its own hero search; the header must not duplicate it there.
  const isHomePage = pathWithoutLocale === '/' || pathWithoutLocale === '';
  const encodedRedirect = encodeURIComponent(pathWithoutLocale);
  const loginHref = `/${locale}/auth/login?redirect=${encodedRedirect}`;
  const signupHref = `/${locale}/auth/signup?redirect=${encodedRedirect}`;

  const iconBtnClass = 'inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-on-surface-variant transition-colors hover:border-[color:var(--color-outline-variant)] hover:bg-surface-container-high hover:text-on-surface';
  const profileMenuItemClass = 'group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-[var(--brand-bg-green)] focus:bg-[var(--brand-bg-green)]';

  return (
    <div className="min-h-screen bg-[color:var(--color-surface)] transition-colors duration-300">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-primary focus:shadow-lg">
        {locale === 'ar' ? 'تخطي إلى المحتوى الرئيسي' : 'Skip to main content'}
      </a>

      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_50%_0%,rgba(85,178,149,0.16),transparent_60%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(85,178,149,0.14),transparent_58%)]" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_bottom,rgba(226,187,78,0.10),transparent_64%)] dark:bg-[radial-gradient(circle_at_bottom,rgba(226,187,78,0.10),transparent_60%)]" />

      <header className="pointer-events-none fixed inset-x-0 top-3 z-40 px-4 md:px-8">
        <div className="mx-auto w-full max-w-[1600px] rounded-[2rem] border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)]/92 px-3 py-2.5 shadow-[0_22px_70px_-52px_rgba(26,26,26,0.65)] backdrop-blur-xl dark:bg-[color:var(--color-surface-container-low)]/92">

          {/* Row 1: Logo | SearchAutocomplete | Actions */}
          <div className="pointer-events-auto flex items-center justify-between gap-2 md:gap-3">

            {/* Logo */}
            <Link href={`/${locale}`} aria-label={t('app.name')}
              className="group inline-flex shrink-0 items-center gap-2.5 rounded-full p-1.5 transition-colors hover:bg-[color:var(--color-primary-container)] dark:hover:bg-[color:var(--color-surface-container-high)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--color-primary-container)] ring-1 ring-[color:var(--color-primary)]/20 dark:bg-[color:var(--color-surface-container-high)]">
                <Image src="/logos/Tawveeri.png" alt="Tawveeri" width={34} height={34} className="h-8 w-8 rounded-full object-contain" />
              </span>
              <span className="hidden flex-col leading-tight sm:flex">
                <span className="text-sm font-bold text-on-surface">{t('app.name')}</span>
                <span className="hidden text-[10px] font-medium text-on-surface-variant lg:block">
                  {isRTL ? 'قارن أسعار الإلكترونيات في السعودية' : 'Compare electronics prices in Saudi Arabia'}
                </span>
              </span>
            </Link>

            {/* Smart Search — Desktop. Hidden on the homepage for the same reason as the
                mobile bar below: the hero IS the search there. Hiding only the mobile one
                fixed nothing at desktop width, which is where the harness measures — the
                homepage still reported 2 search fields after the first attempt. */}
            <div className={cn('hidden flex-1 justify-center md:flex', isHomePage && 'md:hidden')}>
              <SearchAutocomplete
                locale={locale}
                compact
                initialQuery={searchQuery}
                onQuery={applyQueryFromVoiceOrBarcode}
                className="w-full max-w-2xl"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 md:gap-1.5">
              <button type="button" onClick={() => goToLocale(locale === 'ar' ? 'en' : 'ar')}
                aria-label={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-transparent px-2.5 text-xs font-semibold text-on-surface-variant transition-colors hover:border-[color:var(--color-outline-variant)] hover:bg-surface-container-high hover:text-on-surface">
                <Globe className="h-4 w-4" strokeWidth={2} />
                <span className="tracking-wide">{locale === 'ar' ? 'EN' : 'AR'}</span>
              </button>

              <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={isHydrated && theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent text-on-surface-variant transition-colors hover:border-[color:var(--color-outline-variant)] hover:bg-surface-container-high hover:text-on-surface">
                {isHydrated ? (
                  theme === 'dark' ? <Sun className="h-4 w-4 text-amber-500" strokeWidth={2} /> : <Moon className="h-4 w-4" strokeWidth={2} />
                ) : <span className="h-4 w-4" aria-hidden="true" />}
              </button>

              {authLoading ? (
                <div className="flex items-center gap-1.5">
                  <div className="h-9 w-20 animate-pulse rounded-xl bg-gray-200/90 dark:bg-gray-700/80" />
                  <div className="h-9 w-24 animate-pulse rounded-xl bg-gray-200/90 dark:bg-gray-700/80" />
                </div>
              ) : user ? (
                <>
                  <Link href={`/${locale}/wishlist`} className={cn(iconBtnClass, 'relative')} aria-label={copy.wishlist}>
                    <Heart className="h-4 w-4" />
                    {wishlistCount > 0 && (
                      <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {wishlistCount > 99 ? '99+' : wishlistCount}
                      </span>
                    )}
                  </Link>

                  <Link href={`/${locale}/notifications`} className={cn(iconBtnClass, 'relative')} aria-label={t('dashboard.sidebar.notifications')}>
                    <Bell className="h-4 w-4" />
                    {notificationCount > 0 && (
                      <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {notificationCount > 99 ? '99+' : notificationCount}
                      </span>
                    )}
                  </Link>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="group inline-flex h-10 max-w-[220px] items-center gap-2 rounded-full border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] p-0.5 ps-3 shadow-[var(--elevation-1)] transition-all hover:border-[var(--brand-green)]/50 hover:bg-[var(--brand-bg-green)] active:scale-[0.98]" aria-label={copy.profile}>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-on-surface-variant transition-transform group-data-[state=open]:rotate-180" />
                        <span className="hidden min-w-0 max-w-[130px] truncate text-sm font-semibold text-on-surface lg:inline">{userFirstName}</span>
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.avatar_url || ''} alt={userName} />
                          <AvatarFallback className="bg-primary-100 text-xs text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">{userInitials}</AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={isRTL ? 'start' : 'end'} sideOffset={10}
                      className="w-[min(380px,calc(100vw-2rem))] rounded-[1.5rem] border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] p-2 shadow-[0_24px_70px_-44px_rgba(26,26,26,0.45)]"
                      style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
                      <DropdownMenuLabel className="p-0">
                        <div className="rounded-[1.25rem] bg-[color:var(--color-surface-container-low)] p-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 ring-2 ring-[var(--brand-green)]/15">
                              <AvatarImage src={user.avatar_url || ''} alt={userName} />
                              <AvatarFallback className="bg-primary-100 text-sm font-bold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">{userInitials}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-on-surface">{userName}</p>
                              {userSubtitle && (
                                <p className="truncate text-xs font-normal text-on-surface-variant" dir="ltr">{userSubtitle}</p>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <Link href={`/${locale}/wishlist`} className="rounded-xl border border-[color:var(--color-outline-variant)]/50 bg-[color:var(--color-surface)] p-2 transition-colors hover:border-[var(--brand-green)]/45 hover:bg-[var(--brand-bg-green)]">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/30"><Heart className="h-3.5 w-3.5" /></span>
                                <span className="text-lg font-black tabular-nums text-on-surface">{wishlistCount > 99 ? '99+' : wishlistCount}</span>
                              </div>
                              <p className="mt-1 truncate text-[11px] font-medium text-on-surface-variant">{copy.wishlist}</p>
                            </Link>
                            <Link href={`/${locale}/notifications`} className="rounded-xl border border-[color:var(--color-outline-variant)]/50 bg-[color:var(--color-surface)] p-2 transition-colors hover:border-[var(--brand-green)]/45 hover:bg-[var(--brand-bg-green)]">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-bg-green)] text-[var(--brand-green-dark)]"><Bell className="h-3.5 w-3.5" /></span>
                                <span className="text-lg font-black tabular-nums text-on-surface">{notificationCount > 99 ? '99+' : notificationCount}</span>
                              </div>
                              <p className="mt-1 truncate text-[11px] font-medium text-on-surface-variant">{t('dashboard.sidebar.notifications')}</p>
                            </Link>
                          </div>
                        </div>
                      </DropdownMenuLabel>
                      <div className="mt-2 grid gap-1">
                        <DropdownMenuItem asChild className={cn(profileMenuItemClass, isActivePath(pathname, `/${locale}/dashboard`) && 'bg-[var(--brand-bg-green)] text-[var(--brand-green-dark)]')}>
                          <Link href={`/${locale}/dashboard`}>
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-surface-container-low)] text-[var(--brand-green-dark)] transition-colors group-hover:bg-[color:var(--color-surface)]"><LayoutDashboard className="h-4 w-4" /></span>
                            <span>{copy.dashboard}</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className={cn(profileMenuItemClass, isActivePath(pathname, `/${locale}/profile`) && 'bg-[var(--brand-bg-green)] text-[var(--brand-green-dark)]')}>
                          <Link href={`/${locale}/profile`}>
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-surface-container-low)] text-[var(--brand-green-dark)] transition-colors group-hover:bg-[color:var(--color-surface)]"><User className="h-4 w-4" /></span>
                            <span>{copy.profile}</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className={cn(profileMenuItemClass, isActivePath(pathname, `/${locale}/price-alerts`) && 'bg-[var(--brand-bg-green)] text-[var(--brand-green-dark)]')}>
                          <Link href={`/${locale}/price-alerts`}>
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-surface-container-low)] text-[var(--brand-green-dark)] transition-colors group-hover:bg-[color:var(--color-surface)]"><SlidersHorizontal className="h-4 w-4" /></span>
                            <span>{copy.priceAlerts}</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className={cn(profileMenuItemClass, isActivePath(pathname, `/${locale}/saved-searches`) && 'bg-[var(--brand-bg-green)] text-[var(--brand-green-dark)]')}>
                          <Link href={`/${locale}/saved-searches`}>
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-surface-container-low)] text-[var(--brand-green-dark)] transition-colors group-hover:bg-[color:var(--color-surface)]"><Search className="h-4 w-4" /></span>
                            <span>{copy.savedSearches}</span>
                          </Link>
                        </DropdownMenuItem>
                      </div>
                      <DropdownMenuSeparator className="my-2" />
                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleSignOut(); }}
                        className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 focus:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/25 dark:focus:bg-red-950/25">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"><LogOut className="h-4 w-4" /></span>
                        <span>{copy.signOut}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Link href={loginHref} className="inline-flex h-9 items-center rounded-full border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] px-3 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface dark:bg-[color:var(--color-surface-container)]">
                    {t('common.login')}
                  </Link>
                  <Link href={signupHref} className="inline-flex h-9 items-center rounded-full bg-[color:var(--color-primary)] px-3.5 text-sm font-semibold text-[color:var(--color-on-primary)] transition-colors hover:bg-primary-600">
                    {copy.getStarted}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Search bar — Mobile.
              HIDDEN ON THE HOMEPAGE: the hero IS the search there, and rendering both put
              TWO search fields on the first screen — two answers to "what do I do here".
              Measured 2026-07-29 as a homepage-journey failure in both locales. */}
          <form onSubmit={handleSearchSubmit}
            className={cn(
              'pointer-events-auto relative mt-3 flex h-11 items-stretch overflow-hidden rounded-full border border-outline-variant bg-surface-container-lowest transition-colors focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 md:hidden',
              isHomePage && 'hidden',
            )}>
            <Search aria-hidden className="pointer-events-none absolute start-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search.searchPlaceholder')} aria-label={t('search.searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent ps-10 pe-2 text-[13px] text-on-surface placeholder:text-on-surface-variant/70 outline-none" />
            <div className="flex shrink-0 items-center">
              <SearchVoiceBarcodeActions locale={locale} onQuery={applyQueryFromVoiceOrBarcode} compact />
            </div>
            <button type="submit" aria-label={t('button.search')}
              className="m-1 inline-flex h-[calc(100%-0.5rem)] w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors hover:bg-primary-600">
              <Search className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </form>

          {/* Row 2: Categories + Quick links */}
          <nav className="pointer-events-auto mt-3 flex items-center gap-1 overflow-x-auto rounded-full bg-[color:var(--color-surface-container-lowest)] p-1 [scrollbar-width:none] dark:bg-[color:var(--color-surface)] [&::-webkit-scrollbar]:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-3.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-600">
                  <LayoutGrid className="h-4 w-4" strokeWidth={2.25} />
                  {isRTL ? 'الفئات' : 'Categories'}
                  <ChevronDown className="h-3.5 w-3.5 opacity-80" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isRTL ? 'end' : 'start'} className="w-[min(620px,90vw)] rounded-2xl border-[color:var(--color-outline-variant)] p-3 shadow-[0_24px_70px_-44px_rgba(26,26,26,0.45)]">
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {/* DERIVED LIVE (ADR-150), and linking to the QUERY path. The old list was
                      hardcoded and sent users to `?category=<slug>`; measured on production,
                      that filter hits the storefront layer and returned 830 laptops with ZERO
                      comparable and a laptop TABLE on top, while `gaming`/`networking`/
                      `accessories` matched no TPS category at all. The query path returns the
                      comparable products. */}
                  {navigableCategories.map((cat) => {
                    const Icon = HEADER_CATEGORY_ICONS[cat.key] ?? Package;
                    return (
                      <DropdownMenuItem key={cat.key} asChild className="cursor-pointer">
                        <Link href={`/${locale}/search?q=${encodeURIComponent(cat.query)}`} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary-50 text-primary-700">
                            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </span>
                          <span className="text-sm">{isRTL ? cat.labelAr : cat.labelEn}</span>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </div>
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href={`/${locale}/search`} className="flex items-center justify-between px-2.5 py-2 text-sm font-semibold text-primary-700">
                    {isRTL ? 'تصفّح كل المنتجات' : 'Browse all products'}
                    {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <span aria-hidden className="mx-1 hidden h-5 w-px shrink-0 bg-outline-variant md:block" />

            {quickNavLinks.map((item) => {
              const isActive = item.href === `/${locale}` ? pathname === item.href : isActivePath(pathname, item.href);
              return (
                <Link key={item.href} href={item.href} aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-medium transition-colors',
                    isActive ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
                  )}>
                  {item.icon && <item.icon className="h-3.5 w-3.5" strokeWidth={1.75} />}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main id="main-content" className={fullBleed ? 'pb-24' : 'mx-auto max-w-[1600px] px-4 pb-24 pt-56 md:px-8 md:pt-48'}>
        {children}
      </main>

      <Footer />
      <CompareFloatingBar locale={locale} />
    </div>
  );
}
