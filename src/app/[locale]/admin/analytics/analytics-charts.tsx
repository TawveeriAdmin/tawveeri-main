'use client';

import { useMemo } from 'react';
import {
  RevenueTrendChart,
  UserGrowthEChart,
  EChartsWrapper,
  useChartThemeColors,
  buildBaseChartOption,
} from '@/components/charts';
import { useTranslations } from '@/lib/simple-intl-provider';
import type {
  RevenueDataPoint,
  UserRegistrationDataPoint,
} from '@/lib/admin/dashboard-queries';

// ─── Types ───────────────────────────────────────────────

interface DistributionItem {
  name: string;
  value: number;
}

interface AnalyticsChartsProps {
  locale: string;
  revenueData: RevenueDataPoint[];
  userGrowthData: UserRegistrationDataPoint[];
  categoryData: DistributionItem[];
  roleData: DistributionItem[];
  storeStatusData: DistributionItem[];
}

// ─── Generic Doughnut Chart ──────────────────────────────

const PIE_COLORS = [
  '#0D47A1', '#10B981', '#D97706', '#EF4444', '#8B5CF6',
  '#06B6D4', '#EC4899', '#F59E0B',
];

function DistributionPieChart({
  data,
  title,
  centerLabel,
  locale,
}: {
  data: DistributionItem[];
  title: string;
  centerLabel: string;
  locale: string;
}) {
  const colors = useChartThemeColors();
  const t = useTranslations();
  const isRTL = locale === 'ar';
  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  const option = useMemo(() => {
    const base = buildBaseChartOption(colors, isRTL);

    return {
      ...base,
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (params: any) =>
          `<div style="font-weight:600">${params.name}</div><div>${params.value} (${params.percent}%)</div>`,
      },
      legend: {
        ...base.legend,
        orient: 'vertical' as const,
        top: 'center',
        ...(isRTL ? { left: 0 } : { right: 0 }),
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 10,
        textStyle: { ...base.legend.textStyle, fontSize: 12 },
      },
      series: [
        {
          type: 'pie',
          radius: ['50%', '75%'],
          center: isRTL ? ['65%', '50%'] : ['35%', '50%'],
          avoidLabelOverlap: false,
          label: {
            show: true,
            position: 'center',
            formatter: () => `{total|${total}}\n{label|${centerLabel}}`,
            rich: {
              total: {
                fontSize: 24,
                fontWeight: 'bold' as const,
                color: colors.onSurface,
                lineHeight: 32,
              },
              label: {
                fontSize: 12,
                color: colors.onSurfaceVariant,
                lineHeight: 18,
              },
            },
          },
          emphasis: {
            label: { show: true },
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' },
          },
          labelLine: { show: false },
          data: data.map((item, i) => ({
            name: item.name,
            value: item.value,
            itemStyle: { color: PIE_COLORS[i % PIE_COLORS.length] },
          })),
          itemStyle: {
            borderColor: colors.surfaceContainerLow,
            borderWidth: 2,
            borderRadius: 4,
          },
        },
      ],
    };
  }, [data, colors, isRTL, total, centerLabel]);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <h3 className="mb-2 text-title-md font-semibold text-on-surface">
        {title}
      </h3>
      <EChartsWrapper
        option={option}
        height={300}
        empty={data.length === 0}
        emptyText={t('admin.dashboard.noData')}
      />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────

export function AnalyticsCharts({
  locale,
  revenueData,
  userGrowthData,
  categoryData,
  roleData,
  storeStatusData,
}: AnalyticsChartsProps) {
  const t = useTranslations();

  return (
    <>
      {/* Growth Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UserGrowthEChart data={userGrowthData} locale={locale} />
        <RevenueTrendChart data={revenueData} locale={locale} />
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DistributionPieChart
          data={categoryData}
          title={t('admin.analytics.categoryDistribution')}
          centerLabel={t('admin.analytics.totalProducts')}
          locale={locale}
        />
        <DistributionPieChart
          data={roleData}
          title={t('admin.analytics.roleDistribution')}
          centerLabel={t('admin.analytics.totalUsers')}
          locale={locale}
        />
        <DistributionPieChart
          data={storeStatusData}
          title={t('admin.analytics.storeStatus')}
          centerLabel={t('admin.analytics.totalStores')}
          locale={locale}
        />
      </div>
    </>
  );
}
