'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartCard } from '@/components/admin/chart-card';
interface BarChartProps {
  data: Array<Record<string, any>>;
  dataKey?: string;
  labelKey?: string;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  className?: string;
  orientation?: 'vertical' | 'horizontal';
  height?: number;
  color?: string;
}

export function BarChart({
  data,
  dataKey = 'value',
  labelKey = 'name',
  title,
  xLabel,
  yLabel,
  className,
  orientation = 'vertical',
  height = 300,
  color = 'rgb(59, 130, 246)',
}: BarChartProps) {
  return (
    <ChartCard title={title || 'Chart'} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          layout={orientation === 'horizontal' ? 'vertical' : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-outline-variant" />
          {orientation === 'vertical' ? (
            <>
              <XAxis dataKey={labelKey} className="text-xs" />
              <YAxis className="text-xs" />
            </>
          ) : (
            <>
              <XAxis type="number" className="text-xs" />
              <YAxis dataKey={labelKey} type="category" className="text-xs" />
            </>
          )}
          <Tooltip />
          <Legend />
          <Bar dataKey={dataKey} fill={color} name={yLabel || 'Value'} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

