'use client';

import { useTranslations } from '@/lib/simple-intl-provider';
import { Users, Package, Store, CreditCard, Banknote, Tag, Bell, TrendingDown, TrendingUp } from 'lucide-react';
import type { DashboardKPIs } from '@/lib/admin/dashboard-queries';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatting';
import { Price } from '@/components/ui/price';

interface DashboardKPICardsProps {
  kpis: DashboardKPIs;
  locale: string;
}

export function DashboardKPICards({ kpis, locale }: DashboardKPICardsProps) {
  const t = useTranslations();
  const isRTL = locale === 'ar';

  const items = [
    {
      title: t('admin.dashboard.totalRevenue'),
      value: kpis.totalRevenue,
      icon: Banknote,
      tone: 'primary',
      currency: true,
      trend: kpis.revenueTrend,
      helper: t('admin.dashboard.vsLastPeriod'),
    },
    {
      title: t('admin.dashboard.totalUsers'),
      value: kpis.totalUsers,
      icon: Users,
      tone: 'ink',
      trend: kpis.usersTrend,
      helper: t('admin.dashboard.vsLastPeriod'),
    },
    {
      title: t('admin.dashboard.totalProducts'),
      value: kpis.totalProducts,
      icon: Package,
      tone: 'neutral',
    },
    {
      title: t('admin.dashboard.totalStores'),
      value: kpis.totalStores,
      icon: Store,
      tone: 'neutral',
    },
    {
      title: t('admin.dashboard.transactions'),
      value: kpis.totalTransactions,
      icon: CreditCard,
      tone: 'neutral',
    },
    {
      title: t('admin.dashboard.activeDeals'),
      value: kpis.activeDeals,
      icon: Tag,
      tone: 'gold',
    },
    {
      title: t('admin.dashboard.priceAlerts'),
      value: kpis.activePriceAlerts,
      icon: Bell,
      tone: 'primary',
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      {items.map((item) => {
        const Icon = item.icon;
        const trend = 'trend' in item ? item.trend : undefined;
        const positive = typeof trend === 'number' && trend >= 0;
        return (
          <section
            key={item.title}
            className={cn(
              'group relative overflow-hidden rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5',
              item.tone === 'primary'
                ? 'border-[#bfe7dc] bg-[#1f6f59] text-white shadow-[0_18px_36px_-28px_rgba(31,111,89,0.75)]'
                : 'border-[#d7ece5] bg-white text-on-surface dark:border-[#263b33] dark:bg-[#141c18] dark:text-white',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-2xl',
                  item.tone === 'primary'
                    ? 'bg-white/16 text-white'
                    : item.tone === 'gold'
                      ? 'bg-[#f3d37a]/30 text-[#8a6410]'
                      : 'bg-[#eaf7f2] text-[#1f6f59]',
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              {typeof trend === 'number' && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black tabular-nums',
                    item.tone === 'primary'
                      ? 'bg-white/14 text-white'
                      : positive
                        ? 'bg-[#e6f7ef] text-[#147150] dark:bg-[#16382e] dark:text-[#9fe4d0]'
                        : 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300',
                  )}
                >
                  {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {positive ? '+' : ''}
                  {formatNumber(trend, locale)}%
                </span>
              )}
            </div>
            <div className="mt-4">
              <p
                className={cn(
                  'text-xs font-bold',
                  item.tone === 'primary' ? 'text-white/75' : 'text-on-surface-variant dark:text-white/60',
                )}
              >
                {item.title}
              </p>
              {'currency' in item && item.currency ? (
                <Price
                  amount={item.value}
                  className={cn('mt-1 text-2xl font-black tracking-tight', item.tone === 'primary' ? 'text-white' : 'text-on-surface dark:text-white')}
                  symbolClassName="h-5 w-5"
                />
              ) : (
                <p
                  className={cn(
                    'mt-1 font-mono text-2xl font-black tracking-tight',
                    item.tone === 'primary' ? 'text-white' : 'text-on-surface dark:text-white',
                  )}
                >
                  {formatNumber(item.value, locale)}
                </p>
              )}
              {'helper' in item && item.helper && (
                <p className={cn('mt-2 text-[11px] font-semibold', item.tone === 'primary' ? 'text-white/65' : 'text-on-surface-variant dark:text-white/55')}>
                  {isRTL ? 'مقارنة بآخر 30 يوم' : item.helper}
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
