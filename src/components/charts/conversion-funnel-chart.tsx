'use client';

import { useMemo } from 'react';
import { EChartsWrapper } from './echarts-wrapper';
import { useChartThemeColors, buildBaseChartOption } from './use-chart-theme';
import { useTranslations } from '@/lib/simple-intl-provider';
import type { ConversionFunnelItem } from '@/lib/admin/dashboard-queries';

interface ConversionFunnelChartProps {
  data: ConversionFunnelItem[];
  locale: string;
  loading?: boolean;
}

const FUNNEL_COLORS = ['#0D47A1', '#D97706', '#10B981'];

export function ConversionFunnelChart({ data, locale, loading }: ConversionFunnelChartProps) {
  const colors = useChartThemeColors();
  const t = useTranslations();
  const isRTL = locale === 'ar';

  const stageLabels: Record<string, string> = {
    clicks: t('admin.dashboard.clicks'),
    conversions: t('admin.dashboard.conversions'),
    completed: t('admin.dashboard.completed'),
  };

  const option = useMemo(() => {
    const base = buildBaseChartOption(colors, isRTL);

    return {
      ...base,
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (params: any) => {
          return `<div style="font-weight:600">${params.name}</div><div>${Number(params.value).toLocaleString()}</div>`;
        },
      },
      series: [
        {
          type: 'funnel',
          top: 20,
          bottom: 20,
          left: '10%',
          right: '10%',
          width: '80%',
          min: 0,
          max: Math.max(...data.map((d) => d.count), 1),
          minSize: '20%',
          maxSize: '100%',
          sort: 'descending',
          gap: 4,
          label: {
            show: true,
            position: 'inside',
            formatter: (params: any) => `${params.name}\n${Number(params.value).toLocaleString()}`,
            color: '#fff',
            fontSize: 13,
            fontWeight: 'bold' as const,
            lineHeight: 20,
          },
          labelLine: { show: false },
          itemStyle: {
            borderColor: colors.surfaceContainerLow,
            borderWidth: 2,
            borderRadius: 4,
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' },
          },
          data: data.map((item, i) => ({
            name: stageLabels[item.stage] || item.stage,
            value: item.count,
            itemStyle: { color: FUNNEL_COLORS[i % FUNNEL_COLORS.length] },
          })),
        },
      ],
    };
  }, [data, colors, isRTL, stageLabels]);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <h3 className="mb-2 text-title-md font-semibold text-on-surface">
        {t('admin.dashboard.conversionFunnel')}
      </h3>
      <EChartsWrapper
        option={option}
        height={300}
        loading={loading}
        empty={data.every((d) => d.count === 0)}
        emptyText={t('admin.dashboard.noData')}
      />
    </div>
  );
}
