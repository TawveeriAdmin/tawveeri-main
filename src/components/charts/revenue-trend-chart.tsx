'use client';

import { useMemo } from 'react';
import { EChartsWrapper } from './echarts-wrapper';
import { useChartThemeColors, buildBaseChartOption } from './use-chart-theme';
import { useTranslations } from '@/lib/simple-intl-provider';
import { sarSvgHtml, sarSvgDataUri } from '@/components/ui/price';
import type { RevenueDataPoint } from '@/lib/admin/dashboard-queries';

interface RevenueTrendChartProps {
  data: RevenueDataPoint[];
  locale: string;
  loading?: boolean;
}

export function RevenueTrendChart({ data, locale, loading }: RevenueTrendChartProps) {
  const colors = useChartThemeColors();
  const t = useTranslations();
  const isRTL = locale === 'ar';

  const option = useMemo(() => {
    const base = buildBaseChartOption(colors, isRTL);
    const dates = data.map((d) => d.date);
    const revenues = data.map((d) => d.revenue);
    const transactions = data.map((d) => d.transactions);

    return {
      ...base,
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        formatter: (params: any[]) => {
          const date = params[0]?.axisValue || '';
          let html = `<div style="font-weight:600;margin-bottom:4px">${date}</div>`;
          for (const p of params) {
            const marker = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-inline-end:6px"></span>`;
            const value = p.seriesIndex === 0
              ? `${Number(p.value).toLocaleString()} ${sarSvgHtml(colors.onSurface)}`
              : p.value;
            html += `<div>${marker}${p.seriesName}: ${value}</div>`;
          }
          return html;
        },
      },
      legend: {
        ...base.legend,
        data: [t('admin.dashboard.revenue'), t('admin.dashboard.transactions')],
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
          axisLabel: {
            color: colors.onSurfaceVariant,
            fontSize: 11,
            formatter: (value: number) => {
              if (value >= 1000) return `${(value / 1000).toFixed(0)}K {sar|}`;
              return `${value} {sar|}`;
            },
            rich: {
              sar: {
                backgroundColor: { image: sarSvgDataUri(colors.onSurfaceVariant) } as any,
                width: 10,
                height: 10,
              },
            },
          },
          splitLine: { lineStyle: { color: colors.outlineVariant, type: 'dashed' } },
        },
        {
          type: 'value',
          position: isRTL ? 'left' : 'right',
          axisLabel: {
            color: colors.onSurfaceVariant,
            fontSize: 11,
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: t('admin.dashboard.revenue'),
          type: 'line',
          smooth: true,
          data: revenues,
          yAxisIndex: 0,
          lineStyle: { width: 2.5, color: colors.primary },
          itemStyle: { color: colors.primary },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: colors.primary + '30' },
                { offset: 1, color: colors.primary + '05' },
              ],
            },
          },
          symbol: 'circle',
          symbolSize: 4,
          showSymbol: false,
          emphasis: { showSymbol: true, symbolSize: 8 },
        },
        {
          name: t('admin.dashboard.transactions'),
          type: 'bar',
          data: transactions,
          yAxisIndex: 1,
          barWidth: '40%',
          itemStyle: {
            color: colors.primaryContainer,
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    };
  }, [data, colors, isRTL, t]);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <h3 className="mb-2 text-title-md font-semibold text-on-surface">
        {t('admin.dashboard.revenueTrend')}
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
