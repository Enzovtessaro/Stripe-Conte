'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { FinancialMetrics } from '@/lib/data-processor';
import { cn } from '@/lib/utils';

interface FinancialOverviewProps {
  metrics: FinancialMetrics;
}

export function FinancialOverview({ metrics }: FinancialOverviewProps) {
  const cards = [
    {
      title: 'Receita Bruta',
      value: metrics.grossRevenue,
      description: 'Total cobrado dos clientes',
      color: 'blue',
    },
    {
      title: 'Taxas Stripe',
      value: metrics.stripeFees,
      description: `${metrics.feePercentage.toFixed(2)}% taxa efetiva`,
      color: 'orange',
    },
    {
      title: 'Receita Líquida',
      value: metrics.netRevenue,
      description: 'Após taxas do Stripe',
      color: 'green',
    },
    {
      title: 'Transferências Bancárias',
      value: metrics.totalPayouts,
      description: 'Enviado para conta bancária',
      color: 'purple',
    },
    {
      title: 'Saldo Disponível',
      value: metrics.availableBalance,
      description: 'Pronto para saque',
      color: 'cyan',
    },
    {
      title: 'Saldo Pendente',
      value: metrics.pendingBalance,
      description: 'Em processamento',
      color: 'yellow',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => {
        return (
          <Card
            key={card.title}
            className="transition-all duration-300 hover:shadow-md"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                {card.title}
              </CardTitle>
            </CardHeader>
            
            <CardContent>
              <div className={cn(
                'text-3xl font-bold',
                card.color === 'green' && 'text-green-600'
              )}>
                {formatCurrency(card.value)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

