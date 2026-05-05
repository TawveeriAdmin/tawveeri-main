'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslations } from '@/lib/simple-intl-provider';
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
import { ChevronLeft, ChevronRight, Languages, LogOut, Menu, Moon, Sun, User } from 'lucide-react';
import { AdminNotifications } from './admin-notifications';
import { useAdminSidebar } from './admin-sidebar-context';

interface AdminHeaderProps {
  userProfile: {
    full_name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  } | null;
  locale: string;
}

const subscribe = () => () => {};

const pageTitleMap: Record<string, string> = {
  '/admin/dashboard': 'admin.sidebar.dashboard',
  '/admin/users': 'admin.users.title',
  '/admin/products': 'admin.products.title',
  '/admin/stores': 'admin.stores.title',
  '/admin/profile': 'admin.header.profile',
  '/admin/affiliate': 'admin.sidebar.affiliate',
  '/admin/coupons': 'admin.sidebar.coupons',
  '/admin/scraping/schedules': 'admin.sidebar.scraping',
  '/admin/scraping/health': 'admin.sidebar.scrapingHealth',
  '/admin/transactions': 'admin.transactions.title',
  '/admin/analytics': 'admin.analytics.title',
  '/admin/analytics/search': 'admin.searchAnalytics.title',
  '/admin/logs': 'admin.logs.title',
  '/admin/reviews': 'admin.reviews.title',
};

export function AdminHeader({ userProfile, locale }: AdminHeaderProps) {
  const { signOut } = useAuth();
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { setMobileOpen } = useAdminSidebar();
  const isRTL = locale === 'ar';
  const isHydrated = useSyncExternalStore(subscribe, () => true, () => false);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = `/${locale}`;
  };

  const switchLocale = () => {
    const nextLocale = locale === 'ar' ? 'en' : 'ar';
    if (!pathname) {
      router.push(`/${nextLocale}`);
      return;
    }
    const nextPath = pathname.startsWith(`/${locale}`)
      ? pathname.replace(`/${locale}`, `/${nextLocale}`)
      : `/${nextLocale}`;
    router.push(nextPath);
  };

  // Resolve page title from current pathname
  const pathnameWithoutLocale = pathname?.replace(/^\/(ar|en)/, '') || '/admin/dashboard';
  let pageTitle = t('admin.dashboard.title');
  const sortedRoutes = Object.keys(pageTitleMap).sort((a, b) => b.length - a.length);
  let currentRoute = '/admin/dashboard';
  for (const route of sortedRoutes) {
    if (pathnameWithoutLocale === route || pathnameWithoutLocale.startsWith(route + '/')) {
      pageTitle = t(pageTitleMap[route]);
      currentRoute = route;
      break;
    }
  }

  if (currentRoute === '/admin/scraping/schedules') {
    pageTitle = isRTL ? 'جداول السكرابر' : 'Scraping schedules';
  }

  const breadcrumbSeparator = isRTL ? ChevronLeft : ChevronRight;
  const BreadcrumbSeparator = breadcrumbSeparator;
  const breadcrumbs = [
    {
      label: t('admin.sidebar.dashboard'),
      href: `/${locale}/admin/dashboard`,
      current: currentRoute === '/admin/dashboard',
    },
  ];

  if (currentRoute.startsWith('/admin/scraping/')) {
    breadcrumbs.push({
      label: t('admin.sidebar.scraping'),
      href: `/${locale}/admin/scraping/schedules`,
      current: false,
    });
  }

  if (currentRoute !== '/admin/dashboard') {
    breadcrumbs.push({
      label: pageTitle,
      href: `/${locale}${currentRoute}`,
      current: true,
    });
  }

  const userInitials = userProfile?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'AD';

  const btnClass = 'inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d7ece5] bg-white/80 text-on-surface-variant transition-all duration-200 hover:border-[#9fd9c9] hover:bg-white hover:text-on-surface dark:border-[#263b33] dark:bg-[#17201b] dark:text-white/70 dark:hover:bg-[#1d2a23] dark:hover:text-white';

  return (
    <header className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-[#d7ece5] bg-white/82 px-4 py-3 backdrop-blur-xl md:px-8 dark:border-[#263b33] dark:bg-[#0f1512]/92">
      {/* Left: hamburger (mobile) + page title */}
      <div className="flex min-w-0 items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d7ece5] bg-white text-on-surface-variant transition-colors hover:bg-[#f4fbf8] md:hidden dark:border-[#263b33] dark:bg-[#17201b] dark:text-white/70"
          aria-label={locale === 'ar' ? 'فتح القائمة' : 'Open menu'}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <nav
            aria-label={isRTL ? 'مسار الصفحة' : 'Breadcrumb'}
            className="hidden min-w-0 items-center gap-1.5 text-sm font-black text-on-surface-variant dark:text-white/55 sm:flex"
          >
            {breadcrumbs.map((crumb, index) => (
              <div key={`${crumb.href}-${index}`} className="flex min-w-0 items-center gap-1.5">
                {index > 0 && (
                  <BreadcrumbSeparator className="h-3.5 w-3.5 shrink-0 text-on-surface-variant/60 dark:text-white/35" />
                )}
                {crumb.current ? (
                  <span className="truncate text-[#1f6f59] dark:text-[#9fe4d0]">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="truncate transition-colors hover:text-[#1f6f59] dark:hover:text-[#9fe4d0]"
                  >
                    {crumb.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <button
          onClick={switchLocale}
          className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-[#d7ece5] bg-white/80 px-3 text-sm font-bold text-on-surface transition-all duration-200 hover:border-[#9fd9c9] hover:bg-white dark:border-[#263b33] dark:bg-[#17201b] dark:text-white dark:hover:bg-[#1d2a23]"
          aria-label="Toggle language"
        >
          <Languages className="h-4 w-4 text-primary" />
          <span>{locale === 'ar' ? 'EN' : 'AR'}</span>
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={btnClass}
          aria-label="Toggle theme"
        >
          {isHydrated ? (
            theme === 'dark' ? (
              <Sun className="h-4 w-4 text-featured-500" />
            ) : (
              <Moon className="h-4 w-4 text-primary" />
            )
          ) : (
            <span className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {/* Notifications */}
        <AdminNotifications locale={locale} />

        {/* Separator */}
        <div className="mx-1 hidden h-8 w-px bg-[#d7ece5] md:block dark:bg-[#263b33]" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-2xl p-0">
              <Avatar className="h-10 w-10 rounded-2xl">
                <AvatarImage src={userProfile?.avatar_url || ''} alt={userProfile?.full_name || ''} />
                <AvatarFallback className="rounded-2xl bg-[#1f6f59] text-[11px] font-black text-white">{userInitials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="center"
            side="bottom"
            sideOffset={10}
            collisionPadding={24}
            avoidCollisions
            dir={isRTL ? 'rtl' : 'ltr'}
            className="w-60 text-start"
          >
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1 text-start">
                <p className="text-sm font-medium text-on-surface dark:text-white">
                  {userProfile?.full_name || 'Admin'}
                </p>
                <p className="truncate text-xs text-on-surface-variant dark:text-white/60" dir="ltr">
                  {userProfile?.email || ''}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer justify-start text-start">
              <Link href={`/${locale}/admin/profile`}>
                <User className="h-4 w-4 shrink-0" />
                {isRTL ? 'الملف الشخصي' : 'Profile'}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => { e.preventDefault(); handleSignOut(); }}
              className="cursor-pointer justify-start text-start text-error"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>{t('admin.header.signOut')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
