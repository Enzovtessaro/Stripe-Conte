'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface OneOffMonth {
  month: string;
  revenue: number;
  count: number;
}

interface OneOffRevenueChartProps {
  data: OneOffMonth[];
  total: number;
  last12Months: number;
}

const brl = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function OneOffRevenueChart({ data, total, last12Months }: OneOffRevenueChartProps) {
  if (data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base md:text-lg">Receita Avulsa — Certificados</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Renovações de certificado digital. Pagamento único, fora da receita recorrente —
          por isso não contam como assinatura nem entram no churn.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 md:gap-8 mb-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Últimos 12 meses</p>
            <p className="text-xl md:text-2xl font-bold">{brl(last12Months)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total no período</p>
            <p className="text-xl md:text-2xl font-bold">{brl(total)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Renovações</p>
            <p className="text-xl md:text-2xl font-bold">
              {data.reduce((sum, item) => sum + item.count, 0)}
            </p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => brl(Number(v))} width={70} />
            <Tooltip
              formatter={(value: number, name: string) =>
                name === 'revenue' ? [brl(value), 'Receita'] : [value, 'Renovações']
              }
            />
            <Legend formatter={(value) => (value === 'revenue' ? 'Receita' : 'Renovações')} />
            <Bar dataKey="revenue" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
