'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  BarChart3,
  Settings,
  CreditCard,
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
        'w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col',
        isRTL && 'border-l border-r-0'
      )}
    >
      {/* Logo/Brand */}
      <div className="h-16 flex items-center justify-center border-b border-gray-200 dark:border-gray-800 px-4">
        <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">
          {t('store.sidebar.storePanel')}
        </h1>
      </div>

      {/* Store Info */}
      {store && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {isRTL ? store.name_ar : store.name_en}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {store.status}
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname?.includes(item.href) || pathname === `/${locale}${item.href}`;
          
          return (
            <Link
              key={item.key}
              href={`/${locale}${item.href}`}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
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

