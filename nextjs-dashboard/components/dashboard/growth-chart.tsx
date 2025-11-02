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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MonthlyMRR } from '@/lib/data-processor';
import { formatCurrency } from '@/lib/utils';

interface GrowthChartProps {
  data: MonthlyMRR[];
}

export function GrowthChart({ data }: GrowthChartProps) {
  const chartData = data.map((item) => ({
    month: item.month,
    'MRR Total': item.totalMRR,
    'Novo MRR': item.newMRR,
    'MRR Existente': item.existingMRR,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tendências de Crescimento</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="month"
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="MRR Total"
              stroke="hsl(0, 72%, 51%)"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="Novo MRR"
              stroke="hsl(221, 83%, 53%)"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="MRR Existente"
              stroke="hsl(142, 76%, 36%)"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

