'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  User,
  Package,
  Store,
  CreditCard,
  HandCoins,
  BarChart3,
  FileText,
  Ticket,
  Bot,
  Activity,
  Gauge,
  FileBarChart,
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
  { href: '/admin/command-center', icon: Gauge, key: 'commandCenter' },
  { href: '/admin/retailer-report', icon: FileBarChart, key: 'retailerReport' },
  { href: '/admin/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { href: '/admin/profile', icon: User, key: 'profile' },
  { href: '/admin/users', icon: Users, key: 'users' },
  { href: '/admin/products', icon: Package, key: 'products' },
  { href: '/admin/stores', icon: Store, key: 'stores' },
  { href: '/admin/affiliate', icon: HandCoins, key: 'affiliate' },
  { href: '/admin/coupons', icon: Ticket, key: 'coupons' },
  { href: '/admin/scraping/schedules', icon: Bot, key: 'scraping' },
  { href: '/admin/scraping/health', icon: Activity, key: 'scrapingHealth' },
  { href: '/admin/transactions', icon: CreditCard, key: 'transactions' },
  { href: '/admin/analytics', icon: BarChart3, key: 'analytics' },
  { href: '/admin/logs', icon: FileText, key: 'logs' },
];

const navGroups = [
  { key: 'core', items: navItems.slice(0, 9) },
  { key: 'operations', items: navItems.slice(9) },
];

export function AdminSidebar({ locale }: AdminSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const isRTL = locale === 'ar';
  const [collapsed, setCollapsed] = useState(false);
  const { mobileOpen, setMobileOpen } = useAdminSidebar();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') {
      queueMicrotask(() => setCollapsed(true));
    }
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
          'group flex items-center gap-3 rounded-2xl text-sm font-semibold transition-all duration-200',
          isActive
            ? 'bg-[#1f6f59] text-white shadow-[0_12px_30px_-18px_rgba(31,111,89,0.8)]'
            : 'text-on-surface-variant hover:bg-white/70 hover:text-on-surface dark:text-white/65 dark:hover:bg-white/8 dark:hover:text-white',
          showLabel ? 'px-3.5 py-3' : 'justify-center px-3 py-3'
        )}
      >
        <Icon className="h-4.5 w-4.5 shrink-0" />
        {showLabel && <span>{label}</span>}
      </Link>
    );
  };

  /* ---- Desktop sidebar ---- */
  const desktopSidebar = (
    <aside
      className={cn(
        'hidden h-[100dvh] shrink-0 self-stretch md:flex flex-col border-e border-white/60 bg-white/90 shadow-[10px_0_40px_-35px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-[width] duration-200 dark:border-[#263b33] dark:bg-[#121814]',
        collapsed ? 'w-[76px]' : 'w-72'
      )}
    >
      {/* Logo / Brand */}
      <div className={cn(
        'flex h-20 items-center border-b border-[#d7ece5] dark:border-[#263b33]',
        collapsed ? 'justify-center px-2' : 'gap-3 px-5'
      )}>
        <Link
          href={`/${locale}/admin/command-center`}
          className={cn(
            'inline-flex shrink-0 items-center gap-3 rounded-2xl p-1 transition-colors hover:bg-[#eff8f5] dark:hover:bg-white/8',
            collapsed && 'justify-center'
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1f6f59] text-sm font-black text-white shadow-[0_14px_30px_-18px_rgba(31,111,89,0.95)]">
            {t('app.initial')}
          </div>
          {!collapsed && (
            <div>
              <span className="block text-base font-black tracking-tight text-on-surface dark:text-white">
                {t('app.name')}
              </span>
              <span className="mt-0.5 block text-[11px] font-semibold text-on-surface-variant dark:text-white/55">
                {locale === 'ar' ? 'مركز الإدارة' : 'Control center'}
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto p-3">
        <TooltipProvider delayDuration={0}>
          {navGroups.map((group) => (
            <div key={group.key} className="space-y-1.5">
              {!collapsed && (
                <p className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant/70 dark:text-white/40">
                  {group.key === 'core'
                    ? locale === 'ar' ? 'الأساسي' : 'Core'
                    : locale === 'ar' ? 'التشغيل' : 'Operations'}
                </p>
              )}
              {group.items.map((item) => {
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
            </div>
          ))}
        </TooltipProvider>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-[#d7ece5] p-3 dark:border-[#263b33]">
        <TooltipProvider delayDuration={0}>
          {(() => {
            const btn = (
              <button
                onClick={toggleCollapsed}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-white hover:text-on-surface dark:text-white/65 dark:hover:bg-white/8 dark:hover:text-white',
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
            href={`/${locale}/admin/command-center`}
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
