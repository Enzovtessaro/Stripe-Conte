'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FailedPayment } from '@/lib/data-processor';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { AlertCircle } from 'lucide-react';

interface FailedPaymentsTableProps {
  payments: FailedPayment[];
}

export function FailedPaymentsTable({ payments }: FailedPaymentsTableProps) {
  return (
    <Card className="border-red-200">
      <CardHeader className="px-3 md:px-6">
        <CardTitle className="flex items-center gap-2 text-red-700 text-base md:text-lg">
          <AlertCircle className="h-4 w-4 md:h-5 md:w-5" />
          <span className="hidden sm:inline">Pagamentos com Falha (Inadimplência)</span>
          <span className="sm:hidden">Inadimplência</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 md:px-6">
        <div className="overflow-x-auto -mx-3 md:mx-0">
          <table className="w-full text-xs md:text-sm min-w-[600px]">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 md:py-3 px-2 md:px-4 font-medium text-muted-foreground">
                  Cliente
                </th>
                <th className="text-left py-2 md:py-3 px-2 md:px-4 font-medium text-muted-foreground hidden md:table-cell">
                  Email
                </th>
                <th className="text-right py-2 md:py-3 px-2 md:px-4 font-medium text-muted-foreground">
                  Valor
                </th>
                <th className="text-center py-2 md:py-3 px-2 md:px-4 font-medium text-muted-foreground">
                  Parcela
                </th>
                <th className="text-right py-2 md:py-3 px-2 md:px-4 font-medium text-muted-foreground">
                  Data
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-xl md:text-2xl">✅</span>
                      <span className="text-xs md:text-sm">Nenhum pagamento com falha - Parabéns!</span>
                    </div>
                  </td>
                </tr>
              ) : (
                payments.slice(0, 100).map((payment) => (
                  <tr key={payment.invoiceId} className="border-b hover:bg-red-50/50">
                    <td className="py-2 md:py-3 px-2 md:px-4 font-medium">
                      <div className="max-w-[120px] md:max-w-none truncate">{payment.customerName}</div>
                      <div className="text-[10px] text-muted-foreground md:hidden truncate max-w-[120px]">{payment.customerEmail}</div>
                    </td>
                    <td className="py-2 md:py-3 px-2 md:px-4 text-muted-foreground hidden md:table-cell">
                      {payment.customerEmail}
                    </td>
                    <td className="py-2 md:py-3 px-2 md:px-4 text-right font-medium text-red-600 whitespace-nowrap">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="py-2 md:py-3 px-2 md:px-4 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full bg-red-100 text-red-700 font-semibold text-[10px] md:text-xs">
                        {payment.installmentNumber}
                      </span>
                    </td>
                    <td className="py-2 md:py-3 px-2 md:px-4 text-right text-muted-foreground whitespace-nowrap text-[10px] md:text-xs">
                      {format(payment.attemptDate, 'dd/MM/yy')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {payments.length > 100 && (
            <div className="text-center py-3 md:py-4 text-xs md:text-sm text-muted-foreground">
              Mostrando 100 de {payments.length} pagamentos com falha
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

