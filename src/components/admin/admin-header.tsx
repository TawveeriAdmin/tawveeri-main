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
import { Languages, LogOut, Menu, Moon, Sun, User } from 'lucide-react';
import { AdminNotifications } from './admin-notifications';
import { useAdminSidebar } from './admin-sidebar-context';

interface AdminHeaderProps {
  userProfile: any;
  locale: string;
}

const subscribe = () => () => {};

const pageTitleMap: Record<string, string> = {
  '/admin/dashboard': 'admin.dashboard.title',
  '/admin/users': 'admin.users.title',
  '/admin/products': 'admin.products.title',
  '/admin/stores': 'admin.stores.title',
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
  for (const route of sortedRoutes) {
    if (pathnameWithoutLocale === route || pathnameWithoutLocale.startsWith(route + '/')) {
      pageTitle = t(pageTitleMap[route]);
      break;
    }
  }

  const userInitials = userProfile?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'AD';

  const btnClass = 'inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container dark:bg-surface-container-high transition-all duration-200 hover:bg-surface-container-high dark:hover:bg-surface-container-highest';

  return (
    <header className="flex h-14 items-center justify-between border-b border-outline-variant bg-surface px-3 md:px-6">
      {/* Left: hamburger (mobile) + page title */}
      <div className="flex items-center gap-2">
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-on-surface/8"
          aria-label={locale === 'ar' ? 'فتح القائمة' : 'Open menu'}
        >
          <Menu className="h-5 w-5" />
        </button>

        <h2 className="text-sm font-semibold text-on-surface md:text-base">
          {pageTitle}
        </h2>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-1.5">
        {/* Language toggle */}
        <button
          onClick={switchLocale}
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-surface-container dark:bg-surface-container-high px-2 text-xs font-medium text-on-surface transition-all duration-200 hover:bg-surface-container-high dark:hover:bg-surface-container-highest md:px-2.5 md:text-sm md:gap-1.5"
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
        <div className="mx-0.5 h-5 w-px bg-outline-variant md:mx-1" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
              <Avatar className="h-8 w-8">
                <AvatarImage src={userProfile?.avatar_url || ''} alt={userProfile?.full_name || ''} />
                <AvatarFallback className="text-[10px]">{userInitials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium text-on-surface">
                  {userProfile?.full_name || 'Admin'}
                </p>
                <p className="truncate text-xs text-on-surface-variant" dir="ltr">
                  {userProfile?.email || ''}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href={`/${locale}/admin/dashboard`}>
                <User className="me-2 h-4 w-4" />
                {t('admin.sidebar.dashboard')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href={`/${locale}/profile`}>
                <User className="me-2 h-4 w-4" />
                {isRTL ? 'الملف الشخصي' : 'Profile'}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => { e.preventDefault(); handleSignOut(); }}
              className="cursor-pointer text-error"
            >
              <LogOut className="me-2 h-4 w-4" />
              <span>{t('admin.header.signOut')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
