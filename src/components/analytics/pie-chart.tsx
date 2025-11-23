'use client';

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { ChartCard } from '@/components/admin/chart-card';
import { cn } from '@/lib/utils';

interface PieChartProps {
  data: Array<{ name: string; value: number }>;
  title?: string;
  className?: string;
}

const COLORS = [
  'rgb(59, 130, 246)',
  'rgb(34, 197, 94)',
  'rgb(251, 191, 36)',
  'rgb(239, 68, 68)',
  'rgb(168, 85, 247)',
  'rgb(236, 72, 153)',
];

export function PieChart({ data, title, className }: PieChartProps) {
  return (
    <ChartCard title={title || 'Chart'} className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => value.toLocaleString()} />
          <Legend />
        </RechartsPieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

