'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  BarChart3,
  Settings,
  CreditCard,
  Ticket,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/simple-intl-provider';

interface StoreSidebarProps {
  locale: string;
  store: any;
}

const navItems = [
  { href: '/store/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { href: '/store/products', icon: Package, key: 'products' },
  { href: '/store/coupons', icon: Ticket, key: 'coupons' },
  { href: '/store/transactions', icon: CreditCard, key: 'transactions' },
  { href: '/store/analytics', icon: BarChart3, key: 'analytics' },
  { href: '/store/settings', icon: Settings, key: 'settings' },
];

export function StoreSidebar({ locale, store }: StoreSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const isRTL = locale === 'ar';

  return (
    <aside
      className={cn(
        'w-64 border-r border-outline-variant bg-surface-container-low flex flex-col',
        isRTL && 'border-l border-r-0'
      )}
    >
      {/* Logo/Brand */}
      <div className="h-16 flex items-center justify-center border-b border-outline-variant px-4">
        <h1 className="text-title-lg text-primary">
          {t('store.sidebar.storePanel')}
        </h1>
      </div>

      {/* Store Info */}
      {store && (
        <div className="p-4 border-b border-outline-variant">
          <p className="text-label-lg text-on-surface">
            {isRTL ? store.name_ar : store.name_en}
          </p>
          <p className="text-body-sm text-on-surface-variant mt-1">
            {store.status}
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname?.includes(item.href) || pathname === `/${locale}${item.href}`;

          return (
            <Link
              key={item.key}
              href={`/${locale}${item.href}`}
              className={cn(
                'state-layer flex items-center gap-3 px-4 py-3 rounded-full text-label-lg transition-colors',
                isActive
                  ? 'bg-secondary-container text-on-secondary-container font-medium'
                  : 'text-on-surface-variant hover:bg-on-surface/8',
                isRTL && 'flex-row-reverse'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{t(`store.sidebar.${item.key}`)}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
