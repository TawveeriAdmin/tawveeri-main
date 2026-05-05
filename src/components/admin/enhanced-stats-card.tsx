'use client';

import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatting';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Price } from '@/components/ui/price';
import type { ReactNode } from 'react';

interface EnhancedStatsCardProps {
  title: string;
  value: number;
  icon: ReactNode;
  isCurrency?: boolean;
  trend?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  secondaryLabel?: string;
  secondaryValue?: string;
  sparklineData?: number[];
  sparklineColor?: string;
  locale?: 'ar' | 'en';
}

function Sparkline({ data, color = '#0D47A1' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;

  const width = 80;
  const height = 28;
  const padding = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((val - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EnhancedStatsCard({
  title,
  value,
  icon,
  isCurrency = false,
  trend,
  secondaryLabel,
  secondaryValue,
  sparklineData,
  sparklineColor,
  locale,
}: EnhancedStatsCardProps) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        {sparklineData && sparklineData.length > 1 && (
          <Sparkline data={sparklineData} color={sparklineColor} />
        )}
      </div>

      <div className="mt-3">
        <p className="text-xs font-medium text-on-surface-variant">{title}</p>
        <div className="mt-1 flex items-baseline gap-2">
          {isCurrency ? (
            <Price
              amount={value}
              className="text-2xl font-bold text-on-surface"
              symbolClassName="w-5 h-5"
            />
          ) : (
            <span className="tabular-nums text-2xl font-bold text-on-surface">
              {formatNumber(value, locale ?? 'en')}
            </span>
          )}
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium',
                trend.type === 'increase'
                  ? 'bg-success/10 text-success'
                  : 'bg-error/10 text-error'
              )}
            >
              {trend.type === 'increase' ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {trend.value > 0 ? '+' : ''}
              {formatNumber(trend.value, locale ?? 'en')}%
            </span>
          )}
        </div>
      </div>

      {secondaryLabel && secondaryValue && (
        <div className="mt-2 border-t border-outline-variant pt-2">
          <p className="text-xs text-on-surface-variant">
            {secondaryLabel}: <span className="font-medium text-on-surface">{secondaryValue}</span>
          </p>
        </div>
      )}
    </div>
  );
}
