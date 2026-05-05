'use client';

import { useRef, useEffect } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart, FunnelChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  TitleComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { cn } from '@/lib/utils';

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  FunnelChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  TitleComponent,
  CanvasRenderer,
]);

interface EChartsWrapperProps {
  option: Record<string, any>;
  height?: number;
  loading?: boolean;
  empty?: boolean;
  emptyText?: string;
  className?: string;
}

export function EChartsWrapper({
  option,
  height = 350,
  loading = false,
  empty = false,
  emptyText = 'No data available',
  className,
}: EChartsWrapperProps) {
  const chartRef = useRef<ReactEChartsCore>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !chartRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      const instance = chartRef.current?.getEchartsInstance();
      instance?.resize();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  if (empty) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest',
          className
        )}
        style={{ height }}
      >
        <p className="text-sm text-on-surface-variant">{emptyText}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('w-full', className)}>
      <ReactEChartsCore
        ref={chartRef}
        echarts={echarts}
        option={option}
        style={{ height, width: '100%' }}
        showLoading={loading}
        loadingOption={{
          text: '',
          color: 'var(--color-primary)',
          maskColor: 'rgba(255, 255, 255, 0.4)',
        }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}

export { echarts };
