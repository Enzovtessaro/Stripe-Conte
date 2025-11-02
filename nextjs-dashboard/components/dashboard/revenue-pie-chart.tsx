'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlanRevenue } from '@/lib/data-processor';
import { formatCurrency } from '@/lib/utils';

interface RevenuePieChartProps {
  data: PlanRevenue[];
}

const COLORS = [
  'hsl(221, 83%, 53%)',
  'hsl(0, 72%, 51%)',
  'hsl(27, 98%, 54%)',
  'hsl(142, 76%, 36%)',
  'hsl(280, 100%, 40%)',
  'hsl(188, 98%, 39%)',
];

export function RevenuePieChart({ data }: RevenuePieChartProps) {
  const chartData = data.map((item) => ({
    name: item.plan,
    value: item.mrr,
    percentage: item.percentage,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receita por Plano</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={140}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

