'use client';

import { EnhancedStatsCard } from '@/components/admin/enhanced-stats-card';
import { useTranslations } from '@/lib/simple-intl-provider';
import {
  Users,
  Package,
  Store,
  CreditCard,
  Banknote,
  Tag,
} from 'lucide-react';
import type { DashboardKPIs } from '@/lib/admin/dashboard-queries';

interface DashboardKPICardsProps {
  kpis: DashboardKPIs;
  locale: string;
}

export function DashboardKPICards({ kpis, locale }: DashboardKPICardsProps) {
  const t = useTranslations();

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      <EnhancedStatsCard
        title={t('admin.dashboard.totalUsers')}
        value={kpis.totalUsers}
        icon={<Users className="h-5 w-5" />}
        trend={
          kpis.usersTrend !== 0
            ? { value: kpis.usersTrend, type: kpis.usersTrend >= 0 ? 'increase' : 'decrease' }
            : undefined
        }
        sparklineData={kpis.usersSparkline}
        sparklineColor="#10B981"
        secondaryLabel={t('admin.dashboard.vsLastPeriod')}
        secondaryValue={`${kpis.usersTrend >= 0 ? '+' : ''}${kpis.usersTrend}%`}
      />
      <EnhancedStatsCard
        title={t('admin.dashboard.totalProducts')}
        value={kpis.totalProducts}
        icon={<Package className="h-5 w-5" />}
      />
      <EnhancedStatsCard
        title={t('admin.dashboard.totalStores')}
        value={kpis.totalStores}
        icon={<Store className="h-5 w-5" />}
      />
      <EnhancedStatsCard
        title={t('admin.dashboard.transactions')}
        value={kpis.totalTransactions}
        icon={<CreditCard className="h-5 w-5" />}
      />
      <EnhancedStatsCard
        title={t('admin.dashboard.totalRevenue')}
        value={kpis.totalRevenue}
        icon={<Banknote className="h-5 w-5" />}
        isCurrency
        trend={
          kpis.revenueTrend !== 0
            ? { value: kpis.revenueTrend, type: kpis.revenueTrend >= 0 ? 'increase' : 'decrease' }
            : undefined
        }
        sparklineData={kpis.revenueSparkline}
        sparklineColor="#0D47A1"
        secondaryLabel={t('admin.dashboard.vsLastPeriod')}
        secondaryValue={`${kpis.revenueTrend >= 0 ? '+' : ''}${kpis.revenueTrend}%`}
      />
      <EnhancedStatsCard
        title={t('admin.dashboard.activeDeals')}
        value={kpis.activeDeals}
        icon={<Tag className="h-5 w-5" />}
      />
    </div>
  );
}
