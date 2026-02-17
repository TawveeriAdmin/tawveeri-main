'use client';

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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/simple-intl-provider';

interface AdminSidebarProps {
  locale: string;
}

const navItems = [
  { href: '/admin/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { href: '/admin/users', icon: Users, key: 'users' },
  { href: '/admin/products', icon: Package, key: 'products' },
  { href: '/admin/stores', icon: Store, key: 'stores' },
  { href: '/admin/transactions', icon: CreditCard, key: 'transactions' },
  { href: '/admin/analytics', icon: BarChart3, key: 'analytics' },
  { href: '/admin/logs', icon: FileText, key: 'logs' },
];

export function AdminSidebar({ locale }: AdminSidebarProps) {
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
          {t('admin.sidebar.adminPanel')}
        </h1>
      </div>

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
              <span>{t(`admin.sidebar.${item.key}`)}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
