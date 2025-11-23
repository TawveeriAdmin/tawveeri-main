'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartCard } from '@/components/admin/chart-card';
import { cn } from '@/lib/utils';
import type { RevenueChartData } from '@/lib/analytics/charts';

interface RevenueChartProps {
  data: RevenueChartData[];
  period: '7d' | '30d' | '90d' | '1y';
  className?: string;
}

export function RevenueChart({ data, period, className }: RevenueChartProps) {
  return (
    <ChartCard
      title="Revenue Over Time"
      className={className}
      actions={
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : period === '90d' ? 'Last 90 days' : 'Last year'}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
            className="text-xs"
          />
          <YAxis
            tickFormatter={(value) => `$${value.toLocaleString()}`}
            className="text-xs"
          />
          <Tooltip
            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
            labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString()}`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="rgb(59, 130, 246)"
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Revenue"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

