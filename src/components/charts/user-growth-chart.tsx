'use client';

import { useMemo } from 'react';
import { EChartsWrapper } from './echarts-wrapper';
import { useChartThemeColors, buildBaseChartOption } from './use-chart-theme';
import { useTranslations } from '@/lib/simple-intl-provider';
import type { UserRegistrationDataPoint } from '@/lib/admin/dashboard-queries';

interface UserGrowthChartProps {
  data: UserRegistrationDataPoint[];
  locale: string;
  loading?: boolean;
}

export function UserGrowthEChart({ data, locale, loading }: UserGrowthChartProps) {
  const colors = useChartThemeColors();
  const t = useTranslations();
  const isRTL = locale === 'ar';

  const option = useMemo(() => {
    const base = buildBaseChartOption(colors, isRTL);
    const dates = data.map((d) => d.date);
    const counts = data.map((d) => d.count);
    const cumulative = data.map((d) => d.cumulative);

    return {
      ...base,
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
      },
      legend: {
        ...base.legend,
        data: [t('admin.dashboard.dailySignups'), t('admin.dashboard.cumulativeUsers')],
        top: 0,
      },
      xAxis: {
        type: 'category',
        data: dates,
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
      yAxis: [
        {
          type: 'value',
          position: isRTL ? 'right' : 'left',
          axisLabel: { color: colors.onSurfaceVariant, fontSize: 11 },
          splitLine: { lineStyle: { color: colors.outlineVariant, type: 'dashed' } },
        },
        {
          type: 'value',
          position: isRTL ? 'left' : 'right',
          axisLabel: { color: colors.onSurfaceVariant, fontSize: 11 },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: t('admin.dashboard.dailySignups'),
          type: 'bar',
          data: counts,
          yAxisIndex: 0,
          barWidth: '50%',
          itemStyle: {
            color: colors.success,
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: t('admin.dashboard.cumulativeUsers'),
          type: 'line',
          data: cumulative,
          yAxisIndex: 1,
          smooth: true,
          lineStyle: { width: 2.5, color: colors.tertiary },
          itemStyle: { color: colors.tertiary },
          symbol: 'circle',
          symbolSize: 4,
          showSymbol: false,
          emphasis: { showSymbol: true, symbolSize: 8 },
        },
      ],
    };
  }, [data, colors, isRTL, t]);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <h3 className="mb-2 text-title-md font-semibold text-on-surface">
        {t('admin.dashboard.userGrowth')}
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
