'use client';

import { useMemo } from 'react';
import { EChartsWrapper } from './echarts-wrapper';
import { useChartThemeColors, buildBaseChartOption } from './use-chart-theme';
import { useTranslations } from '@/lib/simple-intl-provider';
import type { DealActivityDataPoint } from '@/lib/admin/dashboard-queries';

interface DealActivityChartProps {
  data: DealActivityDataPoint[];
  locale: string;
  loading?: boolean;
}

export function DealActivityChart({ data, locale, loading }: DealActivityChartProps) {
  const colors = useChartThemeColors();
  const t = useTranslations();
  const isRTL = locale === 'ar';

  const option = useMemo(() => {
    const base = buildBaseChartOption(colors, isRTL);
    const dates = data.map((d) => d.date);
    const activeDeals = data.map((d) => d.activeDeals);
    const newDeals = data.map((d) => d.newDeals);

    return {
      ...base,
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
      },
      legend: {
        ...base.legend,
        data: [t('admin.dashboard.activeDeals'), t('admin.dashboard.newDeals')],
        top: 0,
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLabel: {
          color: colors.onSurfaceVariant,
          fontSize: 11,
          formatter: (value: string) => {
            const d = new Date(value);
            return `${d.getMonth() + 1}/${d.getDate()}`;
          },
        },
        axisLine: { lineStyle: { color: colors.outlineVariant } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        position: isRTL ? 'right' : 'left',
        axisLabel: { color: colors.onSurfaceVariant, fontSize: 11 },
        splitLine: { lineStyle: { color: colors.outlineVariant, type: 'dashed' } },
      },
      series: [
        {
          name: t('admin.dashboard.activeDeals'),
          type: 'line',
          stack: 'deals',
          smooth: true,
          data: activeDeals,
          lineStyle: { width: 2, color: colors.tertiary },
          itemStyle: { color: colors.tertiary },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: colors.tertiary + '40' },
                { offset: 1, color: colors.tertiary + '05' },
              ],
            },
          },
          showSymbol: false,
        },
        {
          name: t('admin.dashboard.newDeals'),
          type: 'line',
          stack: 'deals',
          smooth: true,
          data: newDeals,
          lineStyle: { width: 2, color: colors.success },
          itemStyle: { color: colors.success },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: colors.success + '40' },
                { offset: 1, color: colors.success + '05' },
              ],
            },
          },
          showSymbol: false,
        },
      ],
    };
  }, [data, colors, isRTL, t]);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <h3 className="mb-2 text-title-md font-semibold text-on-surface">
        {t('admin.dashboard.dealActivity')}
      </h3>
      <EChartsWrapper
        option={option}
        height={350}
        loading={loading}
        empty={data.length === 0}
        emptyText={t('admin.dashboard.noData')}
      />
    </div>
  );
}
