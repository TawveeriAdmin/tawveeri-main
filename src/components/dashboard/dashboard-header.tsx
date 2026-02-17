'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Menu,
  Sun,
  Moon,
  Languages,
  Bell,
  LogOut,
  User,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useSidebar } from './sidebar-context';
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

export function DashboardHeader() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const t = useTranslations();
  const { setMobileOpen } = useSidebar();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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

  const handleSignOut = async () => {
    await signOut();
    router.push(`/${locale}/auth/login`);
  };

  // Detect fake Supabase-generated email for phone users (e.g. phone_966...@tawveeri...)
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
    <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-4 md:px-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      {/* Left: mobile hamburger + page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href={`/${locale}/dashboard`} className="text-lg font-bold text-primary-600 dark:text-primary-400">
          {t('dashboard.title')}
        </Link>
      </div>

      {/* Right: toggles + bell + profile */}
      <div className="flex items-center gap-1.5 md:gap-2">
        {/* Language toggle */}
        <button
          onClick={switchLocale}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle language"
        >
          <Languages className="w-4 h-4" />
          <span className="hidden sm:inline">{locale === 'ar' ? 'EN' : 'AR'}</span>
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="rounded-lg p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle theme"
        >
          {mounted ? (
            theme === 'dark' ? (
              <Sun className="w-4.5 h-4.5 text-amber-500" />
            ) : (
              <Moon className="w-4.5 h-4.5" />
            )
          ) : (
            <div className="w-4.5 h-4.5" />
          )}
        </button>

        {/* Notification bell */}
        <Link
          href={`/${locale}/notifications`}
          className="relative rounded-lg p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Bell className="w-4.5 h-4.5" />
        </Link>

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.avatar_url || ''} alt={userName} />
                <AvatarFallback className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
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
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate" dir="ltr">
                  {userSubtitle}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href={`/${locale}/profile`}>
                <User className="w-4 h-4 me-2" />
                {t('dashboard.profileMenu.profile')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href={`/${locale}/settings`}>
                <Settings className="w-4 h-4 me-2" />
                {t('dashboard.profileMenu.settings')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600 dark:text-red-400">
              <LogOut className="w-4 h-4 me-2" />
              {t('dashboard.profileMenu.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
