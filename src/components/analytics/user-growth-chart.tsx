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
import type { ChartDataPoint } from '@/lib/analytics/charts';

interface UserGrowthChartProps {
  data: ChartDataPoint[];
  period: '7d' | '30d' | '90d' | '1y';
  className?: string;
}

export function UserGrowthChart({ data, period, className }: UserGrowthChartProps) {
  return (
    <ChartCard
      title="User Growth"
      className={className}
      actions={
        <div className="text-xs text-on-surface-variant">
          {period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : period === '90d' ? 'Last 90 days' : 'Last year'}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-outline-variant" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
            className="text-xs"
          />
          <YAxis className="text-xs" />
          <Tooltip
            formatter={(value: number) => [value.toLocaleString(), 'Users']}
            labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString()}`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            stroke="rgb(34, 197, 94)"
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Total Users"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

