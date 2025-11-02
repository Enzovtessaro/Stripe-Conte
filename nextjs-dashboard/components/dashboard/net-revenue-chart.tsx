'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MonthlyFinancials } from '@/lib/data-processor';
import { formatCurrency } from '@/lib/utils';

interface NetRevenueChartProps {
  data: MonthlyFinancials[];
}

export function NetRevenueChart({ data }: NetRevenueChartProps) {
  const chartData = data.map((item) => ({
    month: item.month,
    'Receita Bruta': item.grossRevenue,
    'Taxas Stripe': item.stripeFees,
    'Receita Líquida': item.netRevenue,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análise de Receitas e Taxas</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
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
            
            {/* Receita Bruta */}
            <Bar
              dataKey="Receita Bruta"
              fill="hsl(217, 91%, 60%)"
              radius={[4, 4, 0, 0]}
            />
            
            {/* Taxas Stripe */}
            <Bar
              dataKey="Taxas Stripe"
              fill="hsl(27, 98%, 54%)"
              radius={[4, 4, 0, 0]}
            />
            
            {/* Receita Líquida */}
            <Bar
              dataKey="Receita Líquida"
              fill="hsl(142, 76%, 36%)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

