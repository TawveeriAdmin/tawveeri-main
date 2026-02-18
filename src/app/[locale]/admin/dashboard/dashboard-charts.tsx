'use client';

import {
  RevenueTrendChart,
  UserGrowthEChart,
  CategoryPieChart,
  StorePerformanceChart,
  ConversionFunnelChart,
  DealActivityChart,
} from '@/components/charts';
import type {
  RevenueDataPoint,
  UserRegistrationDataPoint,
  CategoryDistributionItem,
  StorePerformanceItem,
  ConversionFunnelItem,
  DealActivityDataPoint,
} from '@/lib/admin/dashboard-queries';

interface DashboardChartsProps {
  locale: string;
  revenueData: RevenueDataPoint[];
  userGrowthData: UserRegistrationDataPoint[];
  categoryData: CategoryDistributionItem[];
  storePerformance: StorePerformanceItem[];
  funnelData: ConversionFunnelItem[];
  dealActivity: DealActivityDataPoint[];
}

export function DashboardCharts({
  locale,
  revenueData,
  userGrowthData,
  categoryData,
  storePerformance,
  funnelData,
  dealActivity,
}: DashboardChartsProps) {
  return (
    <>
      {/* Primary Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RevenueTrendChart data={revenueData} locale={locale} />
        <UserGrowthEChart data={userGrowthData} locale={locale} />
      </div>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <CategoryPieChart data={categoryData} locale={locale} />
        <StorePerformanceChart data={storePerformance} locale={locale} />
        <ConversionFunnelChart data={funnelData} locale={locale} />
      </div>

      {/* Deal Activity */}
      <div className="grid grid-cols-1 gap-6">
        <DealActivityChart data={dealActivity} locale={locale} />
      </div>
    </>
  );
}
