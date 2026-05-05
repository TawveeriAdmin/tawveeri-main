'use client';

import { useMemo } from 'react';
import { EChartsWrapper } from './echarts-wrapper';
import { useChartThemeColors, buildBaseChartOption } from './use-chart-theme';
import { useTranslations } from '@/lib/simple-intl-provider';
import type { CategoryDistributionItem } from '@/lib/admin/dashboard-queries';

interface CategoryPieChartProps {
  data: CategoryDistributionItem[];
  locale: string;
  loading?: boolean;
}

const CHART_COLORS = [
  '#0D47A1', '#10B981', '#D97706', '#EF4444', '#8B5CF6',
  '#06B6D4', '#EC4899', '#F59E0B',
];

export function CategoryPieChart({ data, locale, loading }: CategoryPieChartProps) {
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
        formatter: (params: any) => {
          return `<div style="font-weight:600">${params.name}</div><div>${params.value} (${params.percent}%)</div>`;
        },
      },
      legend: {
        ...base.legend,
        orient: 'vertical' as const,
        top: 'center',
        ...(isRTL ? { left: 0 } : { right: 0 }),
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 10,
        textStyle: {
          ...base.legend.textStyle,
          fontSize: 12,
        },
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
            formatter: () => `{total|${total}}\n{label|${t('admin.dashboard.totalProducts')}}`,
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
            itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
          })),
          itemStyle: {
            borderColor: colors.surfaceContainerLow,
            borderWidth: 2,
            borderRadius: 4,
          },
        },
      ],
    };
  }, [data, colors, isRTL, t, total]);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <h3 className="mb-2 text-title-md font-semibold text-on-surface">
        {t('admin.dashboard.categoryDistribution')}
      </h3>
      <EChartsWrapper
        option={option}
        height={300}
        loading={loading}
        empty={data.length === 0}
        emptyText={t('admin.dashboard.noData')}
      />
    </div>
  );
}
