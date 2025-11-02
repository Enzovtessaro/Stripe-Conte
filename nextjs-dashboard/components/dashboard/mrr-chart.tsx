'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MonthlyMRR } from '@/lib/data-processor';
import { formatCurrency } from '@/lib/utils';

interface MRRChartProps {
  data: MonthlyMRR[];
}

export function MRRChart({ data }: MRRChartProps) {
  const [isHovering, setIsHovering] = useState(false);

  const chartData = data.map((item) => ({
    month: item.month,
    'Novo MRR': item.newMRR,
    'MRR Existente': item.existingMRR,
    total: item.totalMRR,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receita Recorrente Mensal</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart 
            data={chartData}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
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
            <Bar
              dataKey="MRR Existente"
              stackId="a"
              fill="hsl(142, 76%, 36%)"
              radius={[0, 0, 4, 4]}
            />
            <Bar
              dataKey="Novo MRR"
              stackId="a"
              fill="hsl(221, 83%, 53%)"
              radius={[4, 4, 0, 0]}
            >
              {!isHovering && (
                <LabelList
                  dataKey="total"
                  position="top"
                  formatter={(value: number) => `$${(value / 1000).toFixed(1)}k`}
                  style={{ fontSize: '11px', fill: 'hsl(var(--foreground))' }}
                />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

