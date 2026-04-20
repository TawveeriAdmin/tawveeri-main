'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Package,
  Store,
  CreditCard,
  BarChart3,
  FileText,
  Ticket,
  Bot,
  Activity,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/simple-intl-provider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAdminSidebar } from './admin-sidebar-context';

interface AdminSidebarProps {
  locale: string;
}

const STORAGE_KEY = 'tawveeri-admin-sidebar-collapsed';

const navItems = [
  { href: '/admin/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { href: '/admin/users', icon: Users, key: 'users' },
  { href: '/admin/products', icon: Package, key: 'products' },
  { href: '/admin/stores', icon: Store, key: 'stores' },
  { href: '/admin/coupons', icon: Ticket, key: 'coupons' },
  { href: '/admin/scraping/schedules', icon: Bot, key: 'scraping' },
  { href: '/admin/scraping/health', icon: Activity, key: 'scrapingHealth' },
  { href: '/admin/transactions', icon: CreditCard, key: 'transactions' },
  { href: '/admin/analytics', icon: BarChart3, key: 'analytics' },
  { href: '/admin/logs', icon: FileText, key: 'logs' },
];

export function AdminSidebar({ locale }: AdminSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const isRTL = locale === 'ar';
  const [collapsed, setCollapsed] = useState(false);
  const { mobileOpen, setMobileOpen } = useAdminSidebar();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') setCollapsed(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const navLink = (item: typeof navItems[number], showLabel: boolean) => {
    const Icon = item.icon;
    const isActive = pathname?.includes(item.href) || pathname === `/${locale}${item.href}`;
    const label = t(`admin.sidebar.${item.key}`);

    return (
      <Link
        key={item.key}
        href={`/${locale}${item.href}`}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'state-layer flex items-center gap-3 rounded-full text-label-lg transition-colors',
          isActive
            ? 'bg-secondary-container text-on-secondary-container font-medium'
            : 'text-on-surface-variant hover:bg-on-surface/8',
          showLabel ? 'px-4 py-3' : 'justify-center px-3 py-3'
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {showLabel && <span>{label}</span>}
      </Link>
    );
  };

  /* ---- Desktop sidebar ---- */
  const desktopSidebar = (
    <aside
      className={cn(
        'hidden md:flex flex-col border-e border-outline-variant bg-surface-container-low transition-[width] duration-200 h-full',
        collapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      {/* Logo / Brand */}
      <div className={cn(
        'flex h-14 items-center border-b border-outline-variant',
        collapsed ? 'justify-center px-2' : 'gap-3 px-4'
      )}>
        <Link
          href={`/${locale}/admin/dashboard`}
          className={cn(
            'inline-flex shrink-0 items-center gap-2.5 rounded-xl p-1 transition-colors hover:bg-on-surface/8',
            collapsed && 'justify-center'
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0a2f7e] to-primary text-xs font-black text-white shadow-sm shadow-primary/15">
            {t('app.initial')}
          </div>
          {!collapsed && (
            <span className="text-base font-bold tracking-tight text-on-surface">
              {t('app.name')}
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        <TooltipProvider delayDuration={0}>
          {navItems.map((item) => {
            const label = t(`admin.sidebar.${item.key}`);

            if (collapsed) {
              return (
                <Tooltip key={item.key}>
                  <TooltipTrigger asChild>{navLink(item, false)}</TooltipTrigger>
                  <TooltipContent side={isRTL ? 'left' : 'right'} sideOffset={8}>
                    {label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return navLink(item, true);
          })}
        </TooltipProvider>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-outline-variant p-2">
        <TooltipProvider delayDuration={0}>
          {(() => {
            const btn = (
              <button
                onClick={toggleCollapsed}
                className={cn(
                  'flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-label-lg text-on-surface-variant transition-colors hover:bg-on-surface/8',
                  collapsed && 'justify-center px-3'
                )}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-5 w-5 shrink-0 rtl:-scale-x-100" />
                ) : (
                  <PanelLeftClose className="h-5 w-5 shrink-0 rtl:-scale-x-100" />
                )}
                {!collapsed && <span>{t('admin.sidebar.collapse')}</span>}
              </button>
            );

            if (collapsed) {
              return (
                <Tooltip>
                  <TooltipTrigger asChild>{btn}</TooltipTrigger>
                  <TooltipContent side={isRTL ? 'left' : 'right'} sideOffset={8}>
                    {t('admin.sidebar.expand')}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return btn;
          })()}
        </TooltipProvider>
      </div>
    </aside>
  );

  /* ---- Mobile overlay ---- */
  const mobileDrawer = mobileOpen ? (
    <div className="md:hidden fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setMobileOpen(false)}
      />
      {/* Drawer */}
      <aside
        className={cn(
          'relative z-10 flex flex-col w-72 bg-surface-container-low shadow-xl animate-in duration-200 h-full',
          isRTL ? 'slide-in-from-right ms-auto' : 'slide-in-from-left'
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-outline-variant px-4">
          <Link
            href={`/${locale}/admin/dashboard`}
            onClick={() => setMobileOpen(false)}
            className="inline-flex items-center gap-2.5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0a2f7e] to-primary text-xs font-black text-white">
              {t('app.initial')}
            </div>
            <span className="text-base font-bold tracking-tight text-on-surface">
              {t('app.name')}
            </span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-on-surface/8"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => navLink(item, true))}
        </nav>
      </aside>
    </div>
  ) : null;

  return (
    <>
      {desktopSidebar}
      {mobileDrawer}
    </>
  );
}
