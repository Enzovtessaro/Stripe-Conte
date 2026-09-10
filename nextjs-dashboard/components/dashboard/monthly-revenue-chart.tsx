'use client';

import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

export interface MonthlyRevenue {
  month: string;
  subscriptions: number;
  oneOff: number;
}

interface MonthlyRevenueChartProps {
  data: MonthlyRevenue[];
}

const SUBSCRIPTIONS = 'Receita de assinaturas';
const ONE_OFF = 'Receita avulsa';

export function MonthlyRevenueChart({ data }: MonthlyRevenueChartProps) {
  const [isHovering, setIsHovering] = useState(false);

  const chartData = data.map((item) => ({
    month: item.month,
    [SUBSCRIPTIONS]: item.subscriptions,
    [ONE_OFF]: item.oneOff,
    total: item.subscriptions + item.oneOff,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receita Mensal</CardTitle>
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
            <Bar dataKey={SUBSCRIPTIONS} stackId="receita" fill="hsl(142, 76%, 36%)" />
            <Bar
              dataKey={ONE_OFF}
              stackId="receita"
              fill="hsl(221, 83%, 53%)"
              radius={[4, 4, 0, 0]}
            >
              {/* O total vai no topo da pilha. Some durante o hover para nao
                  brigar com o tooltip. */}
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
