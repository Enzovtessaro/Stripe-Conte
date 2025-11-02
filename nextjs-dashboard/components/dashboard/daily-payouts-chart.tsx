'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DailyPayout } from '@/lib/data-processor';
import { formatCurrency } from '@/lib/utils';

interface DailyPayoutsChartProps {
  data: DailyPayout[];
}

export function DailyPayoutsChart({ data }: DailyPayoutsChartProps) {
  const chartData = data.map((item) => ({
    date: item.date,
    'Valor': item.amount,
    'Quantidade': item.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transferências Bancárias Diárias</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'Valor') {
                  return formatCurrency(value);
                }
                return `${value} transferência${value !== 1 ? 's' : ''}`;
              }}
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Bar
              dataKey="Valor"
              fill="hsl(280, 100%, 40%)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

