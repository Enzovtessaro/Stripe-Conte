'use client';

import { useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CustomerTrend } from '@/lib/data-processor';

interface CustomerChartProps {
  data: CustomerTrend[];
}

export function CustomerChart({ data }: CustomerChartProps) {
  const [isHovering, setIsHovering] = useState(false);

  const chartData = data.map((item) => ({
    month: item.month,
    'Novos Clientes': item.newCustomers,
    'Total de Clientes': item.cumulativeCustomers,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insights de Clientes</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart 
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
              yAxisId="left"
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="Novos Clientes"
              fill="hsl(142, 76%, 36%)"
              radius={[4, 4, 0, 0]}
            >
              {!isHovering && (
                <LabelList
                  position="top"
                  style={{ fontSize: '11px', fill: 'hsl(142, 76%, 36%)' }}
                />
              )}
            </Bar>
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="Total de Clientes"
              stroke="hsl(0, 72%, 51%)"
              strokeWidth={3}
              dot={{ r: 4 }}
            >
              {!isHovering && (
                <LabelList
                  position="top"
                  style={{ fontSize: '11px', fill: 'hsl(0, 72%, 51%)' }}
                />
              )}
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

