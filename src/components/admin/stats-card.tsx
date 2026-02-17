'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  icon: React.ReactNode;
  className?: string;
}

export function StatsCard({ title, value, change, icon, className }: StatsCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-outline-variant bg-surface-container-low p-6',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-label-lg text-on-surface-variant">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-headline-md text-on-surface">{value}</p>
            {change && (
              <div
                className={cn(
                  'flex items-center gap-1 text-label-md',
                  change.type === 'increase'
                    ? 'text-success'
                    : 'text-error'
                )}
              >
                {change.type === 'increase' ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span>{Math.abs(change.value)}%</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 rounded-xl bg-primary-container p-3">
          <div className="text-on-primary-container">{icon}</div>
        </div>
      </div>
    </div>
  );
}
