'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import {
  LayoutDashboard,
  Heart,
  Bell,
  BellRing,
  User,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { useSidebar } from './sidebar-context';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { href: '/wishlist', icon: Heart, key: 'wishlist' },
  { href: '/price-alerts', icon: Bell, key: 'priceAlerts' },
  { href: '/notifications', icon: BellRing, key: 'notifications' },
  { href: '/profile', icon: User, key: 'profile' },
  { href: '/settings', icon: Settings, key: 'settings' },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();
  const { signOut } = useAuth();
  const { collapsed, mobileOpen, toggleCollapsed, setMobileOpen } = useSidebar();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = `/${locale}`;
  };

  const logoutButton = (
    <div className="p-3 border-t border-gray-200 dark:border-gray-800">
      <TooltipProvider delayDuration={0}>
        {(() => {
          const btn = (
            <button
              onClick={handleSignOut}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors w-full',
                'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
                collapsed && !mobileOpen && 'justify-center px-2'
              )}
            >
              <LogOut className="w-5 h-5 shrink-0" />
              {(!collapsed || mobileOpen) && (
                <span>{t('dashboard.profileMenu.signOut')}</span>
              )}
            </button>
          );

          if (collapsed && !mobileOpen) {
            return (
              <Tooltip>
                <TooltipTrigger asChild>{btn}</TooltipTrigger>
                <TooltipContent side={locale === 'ar' ? 'left' : 'right'} sideOffset={8}>
                  {t('dashboard.profileMenu.signOut')}
                </TooltipContent>
              </Tooltip>
            );
          }
          return btn;
        })()}
      </TooltipProvider>
    </div>
  );

  const sidebarContent = (
    <nav className="flex-1 p-3 space-y-1">
      <TooltipProvider delayDuration={0}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const fullHref = `/${locale}${item.href}`;
          const isActive =
            pathname === fullHref ||
            (item.href !== '/dashboard' && pathname?.startsWith(fullHref));

          const link = (
            <Link
              key={item.key}
              href={fullHref}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200',
                collapsed && !mobileOpen && 'justify-center px-2'
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {(!collapsed || mobileOpen) && (
                <span>{t(`dashboard.sidebar.${item.key}`)}</span>
              )}
            </Link>
          );

          if (collapsed && !mobileOpen) {
            return (
              <Tooltip key={item.key}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side={locale === 'ar' ? 'left' : 'right'} sideOffset={8}>
                  {t(`dashboard.sidebar.${item.key}`)}
                </TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}
      </TooltipProvider>
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-e border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 transition-[width] duration-200 h-full',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Collapse toggle */}
        <div className={cn(
          'flex items-center border-b border-gray-200 dark:border-gray-800 h-16 px-3',
          collapsed ? 'justify-center' : 'justify-between'
        )}>
          {!collapsed && (
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {t('dashboard.sidebar.dashboard')}
            </span>
          )}
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={collapsed ? t('dashboard.sidebar.expand') : t('dashboard.sidebar.collapse')}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
        </div>

        {sidebarContent}
        {logoutButton}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside className="relative z-10 flex flex-col w-72 bg-white dark:bg-gray-950 shadow-xl animate-in slide-in-from-start duration-200 h-full">
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-800">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t('dashboard.sidebar.dashboard')}
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {sidebarContent}
            {logoutButton}
          </aside>
        </div>
      )}
    </>
  );
}
