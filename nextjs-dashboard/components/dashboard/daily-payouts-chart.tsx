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
    stripeAmount: item.stripeAmount ?? 0,
    pixAmount: item.pixAmount ?? 0,
    stripeCount: item.stripeCount ?? 0,
    pixCount: item.pixCount ?? 0,
  }));

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ dataKey: string; value: number; payload: (typeof chartData)[number] }>;
    label?: string;
  }) => {
    if (!active || !payload || payload.length === 0) {
      return null;
    }

    const stripe = payload.find((item) => item.dataKey === 'stripeAmount');
    const pix = payload.find((item) => item.dataKey === 'pixAmount');
    const total =
      (stripe?.value ?? 0) + (pix?.value ?? 0);

    return (
      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-sm">
        <div className="font-medium text-foreground mb-1">{label}</div>
        <div className="space-y-1">
          {stripe && stripe.value > 0 && (
            <div className="flex items-center justify-between gap-6">
              <span className="text-muted-foreground">Stripe</span>
              <span className="font-semibold text-blue-600">
                {formatCurrency(stripe.value)}{' '}
                <span className="text-[10px] font-normal text-muted-foreground">
                  ({stripe.payload.stripeCount} transf.)
                </span>
              </span>
            </div>
          )}
          {pix && pix.value > 0 && (
            <div className="flex items-center justify-between gap-6">
              <span className="text-muted-foreground">PIX</span>
              <span className="font-semibold text-green-600">
                {formatCurrency(pix.value)}{' '}
                <span className="text-[10px] font-normal text-muted-foreground">
                  ({pix.payload.pixCount} transf.)
                </span>
              </span>
            </div>
          )}
          <div className="flex items-center justify-between gap-6 pt-1 border-t border-muted">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    );
  };

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
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              formatter={(value) => (
                <span className="text-xs md:text-sm text-muted-foreground">{value}</span>
              )}
            />
            <Bar
              dataKey="stripeAmount"
              name="Stripe"
              stackId="payouts"
              fill="hsl(217, 91%, 60%)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="pixAmount"
              name="PIX"
              stackId="payouts"
              fill="hsl(142, 76%, 36%)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

