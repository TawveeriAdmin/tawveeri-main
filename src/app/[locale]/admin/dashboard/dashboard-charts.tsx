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
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1f6f59]">
            {locale === 'ar' ? 'قراءة الأداء' : 'Performance readout'}
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-on-surface dark:text-white">
            {locale === 'ar' ? 'المؤشرات التشغيلية' : 'Operating signals'}
          </h2>
        </div>
        <span className="hidden rounded-full border border-[#d7ece5] bg-white/80 px-3 py-1.5 text-xs font-bold text-on-surface-variant md:inline-flex dark:border-[#263b33] dark:bg-[#141c18] dark:text-white/65">
          {locale === 'ar' ? 'آخر 30 يوم' : 'Last 30 days'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="overflow-hidden rounded-[1.6rem] border border-[#d7ece5] bg-white/90 p-1 dark:border-[#263b33] dark:bg-[#141c18] xl:col-span-7">
          <RevenueTrendChart data={revenueData} locale={locale} />
        </div>
        <div className="overflow-hidden rounded-[1.6rem] border border-[#d7ece5] bg-white/90 p-1 dark:border-[#263b33] dark:bg-[#141c18] xl:col-span-5">
          <UserGrowthEChart data={userGrowthData} locale={locale} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="overflow-hidden rounded-[1.6rem] border border-[#d7ece5] bg-white/90 p-1 dark:border-[#263b33] dark:bg-[#141c18]">
          <CategoryPieChart data={categoryData} locale={locale} />
        </div>
        <div className="overflow-hidden rounded-[1.6rem] border border-[#d7ece5] bg-white/90 p-1 dark:border-[#263b33] dark:bg-[#141c18]">
          <StorePerformanceChart data={storePerformance} locale={locale} />
        </div>
        <div className="overflow-hidden rounded-[1.6rem] border border-[#d7ece5] bg-white/90 p-1 dark:border-[#263b33] dark:bg-[#141c18]">
          <ConversionFunnelChart data={funnelData} locale={locale} />
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.6rem] border border-[#d7ece5] bg-white/90 p-1 dark:border-[#263b33] dark:bg-[#141c18]">
        <DealActivityChart data={dealActivity} locale={locale} />
      </div>
    </section>
  );
}
