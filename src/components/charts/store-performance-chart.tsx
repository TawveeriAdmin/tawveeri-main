'use client';

import { useMemo } from 'react';
import { EChartsWrapper } from './echarts-wrapper';
import { useChartThemeColors, buildBaseChartOption } from './use-chart-theme';
import { useTranslations } from '@/lib/simple-intl-provider';
import type { StorePerformanceItem } from '@/lib/admin/dashboard-queries';

interface StorePerformanceChartProps {
  data: StorePerformanceItem[];
  locale: string;
  loading?: boolean;
}

export function StorePerformanceChart({ data, locale, loading }: StorePerformanceChartProps) {
  const colors = useChartThemeColors();
  const t = useTranslations();
  const isRTL = locale === 'ar';

  const option = useMemo(() => {
    const base = buildBaseChartOption(colors, isRTL);
    const names = data.map((d) => d.name);
    const revenues = data.map((d) => d.revenue);

    return {
      ...base,
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => {
          const p = params[0];
          if (!p) return '';
          return `<div style="font-weight:600">${p.name}</div><div>${Number(p.value).toLocaleString()} SAR</div>`;
        },
      },
      grid: {
        ...base.grid,
        left: isRTL ? 20 : 10,
        right: isRTL ? 10 : 20,
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: colors.onSurfaceVariant,
          fontSize: 11,
          formatter: (value: number) => {
            if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
            return String(value);
          },
        },
        splitLine: { lineStyle: { color: colors.outlineVariant, type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: names,
        inverse: true,
        axisLabel: {
          color: colors.onSurfaceVariant,
          fontSize: 12,
          width: 100,
          overflow: 'truncate',
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: revenues,
          barWidth: '60%',
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: colors.primary },
                { offset: 1, color: colors.primary + '80' },
              ],
            },
            borderRadius: isRTL ? [4, 0, 0, 4] : [0, 4, 4, 0],
          },
          label: {
            show: true,
            position: 'right',
            color: colors.onSurfaceVariant,
            fontSize: 11,
            formatter: (params: any) => {
              const val = params.value;
              if (val >= 1000) return `${(val / 1000).toFixed(1)}K SAR`;
              return `${val} SAR`;
            },
          },
        },
      ],
    };
  }, [data, colors, isRTL, t]);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <h3 className="mb-2 text-title-md font-semibold text-on-surface">
        {t('admin.dashboard.storePerformance')}
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
