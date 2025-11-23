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

interface AdminSidebarProps {
  locale: string;
}

const navItems = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard', key: 'dashboard' },
  { href: '/admin/users', icon: Users, label: 'Users', key: 'users' },
  { href: '/admin/products', icon: Package, label: 'Products', key: 'products' },
  { href: '/admin/stores', icon: Store, label: 'Stores', key: 'stores' },
  { href: '/admin/transactions', icon: CreditCard, label: 'Transactions', key: 'transactions' },
  { href: '/admin/analytics', icon: BarChart3, label: 'Analytics', key: 'analytics' },
  { href: '/admin/logs', icon: FileText, label: 'Logs', key: 'logs' },
];

export function AdminSidebar({ locale }: AdminSidebarProps) {
  const pathname = usePathname();
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
          {locale === 'ar' ? 'لوحة التحكم' : 'Admin Panel'}
        </h1>
      </div>

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
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

