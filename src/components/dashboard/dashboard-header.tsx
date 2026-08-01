'use client';

import { useState, useSyncExternalStore, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Search,
  Sun,
  Moon,
  Languages,
  Bell,
  LogOut,
  User,
  Settings,
  Heart,
  PackageSearch,
  LayoutDashboard,
  BellRing,
  SlidersHorizontal,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslations } from '@/lib/simple-intl-provider';
import { navigateToLocale } from '@/lib/i18n/switch-locale';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const subscribe = () => () => {};

export function DashboardHeader() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState('');
  const isHydrated = useSyncExternalStore(subscribe, () => true, () => false);

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: t('dashboard.sidebar.dashboard') },
    { href: '/products', icon: PackageSearch, label: t('nav.products') },
    { href: '/wishlist', icon: Heart, label: t('dashboard.sidebar.wishlist') },
    { href: '/price-alerts', icon: SlidersHorizontal, label: t('dashboard.sidebar.priceAlerts') },
    { href: '/notifications', icon: BellRing, label: t('dashboard.sidebar.notifications') },
    { href: '/settings', icon: Settings, label: t('dashboard.sidebar.settings') },
  ];

  // Document load, not `router.push` — see `navigateToLocale`.
  const switchLocale = () => navigateToLocale(locale, locale === 'ar' ? 'en' : 'ar', pathname);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = `/${locale}`;
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    router.push(
      query
        ? `/${locale}/search?q=${encodeURIComponent(query)}`
        : `/${locale}/search`
    );
  };

  const isFakeEmail = user?.email?.startsWith('phone_') ?? false;
  const userPhone = user?.phone || '';
  const realEmail = isFakeEmail ? '' : (user?.email || '');
  const userName = user?.full_name || (realEmail ? realEmail.split('@')[0] : userPhone) || '';
  const userSubtitle = realEmail || userPhone;
  const userInitials =
    userName
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/95 backdrop-blur-md dark:border-gray-800/80 dark:bg-gray-950/95">
      <div className="mx-auto w-full max-w-[1440px] px-3 py-3 md:px-6">
        <div className="flex items-center gap-2 md:gap-3">
          <Link
            href={`/${locale}/dashboard`}
            className="group inline-flex shrink-0 items-center gap-2 rounded-xl p-1 transition-colors hover:bg-gray-100/80 dark:hover:bg-gray-800/70"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-extrabold text-on-primary">
              TV
            </span>
            <div className="hidden min-w-0 sm:block">
              <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                Tawveeri
              </p>
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t('dashboard.title')}
              </p>
            </div>
          </Link>

          <form
            onSubmit={handleSearchSubmit}
            className="relative hidden flex-1 items-center md:flex"
          >
            <Search className="pointer-events-none absolute start-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('dashboard.searchProducts')}
              className="h-11 w-full rounded-xl border border-gray-200 bg-gray-100/80 pe-3 ps-9 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-500 focus:border-primary-500 focus:bg-white dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100 dark:placeholder:text-gray-400 dark:focus:border-primary-400 dark:focus:bg-gray-900"
            />
            <Button
              type="submit"
              className="ms-2 h-11 rounded-xl px-4 text-sm font-semibold"
            >
              <Search className="h-4 w-4" />
              <span className="hidden lg:inline">{t('dashboard.quickAction.search')}</span>
            </Button>
          </form>

          <div className="ms-auto flex items-center gap-1 md:gap-1.5">
            <button
              onClick={switchLocale}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              aria-label="Toggle language"
            >
              <Languages className="h-4 w-4" />
              <span className="hidden sm:inline">{locale === 'ar' ? 'EN' : 'AR'}</span>
            </button>

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
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

            <Link
              href={`/${locale}/wishlist`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              aria-label={t('dashboard.sidebar.wishlist')}
            >
              <Heart className="h-4 w-4" />
            </Link>

            <Link
              href={`/${locale}/notifications`}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              aria-label={t('dashboard.sidebar.notifications')}
            >
              <Bell className="h-4 w-4" />
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.avatar_url || ''} alt={userName} />
                    <AvatarFallback className="text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={locale === 'ar' ? 'start' : 'end'} className="w-56">
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
                  <Link href={`/${locale}/profile`}>
                    <User className="me-2 h-4 w-4" />
                    {t('dashboard.profileMenu.profile')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href={`/${locale}/settings`}>
                    <Settings className="me-2 h-4 w-4" />
                    {t('dashboard.profileMenu.settings')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => { e.preventDefault(); handleSignOut(); }}
                  className="cursor-pointer text-red-600 dark:text-red-400"
                >
                  <LogOut className="me-2 h-4 w-4" />
                  {t('dashboard.profileMenu.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="relative mt-3 flex items-center md:hidden">
          <Search className="pointer-events-none absolute start-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('dashboard.searchProducts')}
            className="h-10 w-full rounded-xl border border-gray-200 bg-gray-100/80 pe-3 ps-9 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-500 focus:border-primary-500 focus:bg-white dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100 dark:placeholder:text-gray-400 dark:focus:border-primary-400"
          />
          <Button type="submit" className="ms-2 h-10 rounded-xl px-3">
            <Search className="h-4 w-4" />
          </Button>
        </form>

        <nav className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
          {navItems.map((item) => {
            const fullHref = `/${locale}${item.href}`;
            const isActive =
              pathname === fullHref ||
              (item.href !== '/dashboard' && pathname?.startsWith(fullHref));

            return (
              <Link
                key={item.href}
                href={fullHref}
                className={cn(
                  'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-sm font-medium transition-colors',
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

          <Link
            href={`/${locale}/compare`}
            className="ms-auto hidden h-9 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-700/70 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/45 lg:inline-flex"
          >
            <BarChart3 className="h-4 w-4" />
            {t('dashboard.compareProducts')}
          </Link>
        </nav>
      </div>
    </header>
  );
}
