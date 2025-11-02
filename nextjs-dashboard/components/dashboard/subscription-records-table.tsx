'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SubscriptionRecord } from '@/lib/data-processor';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SubscriptionRecordsTableProps {
  records: SubscriptionRecord[];
}

const ITEMS_PER_PAGE = 25;

export function SubscriptionRecordsTable({ records }: SubscriptionRecordsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = Math.ceil(records.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentRecords = records.slice(startIndex, endIndex);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <Card>
      <CardHeader className="px-3 md:px-6">
        <CardTitle className="text-base md:text-lg">Registros de Assinaturas Executadas</CardTitle>
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
              {records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado
                  </td>
                </tr>
              ) : (
                currentRecords.map((record) => (
                  <tr key={record.invoiceId} className="border-b hover:bg-muted/50">
                    <td className="py-2 md:py-3 px-2 md:px-4 font-medium">
                      <div className="max-w-[120px] md:max-w-none truncate">{record.customerName}</div>
                      <div className="text-[10px] text-muted-foreground md:hidden truncate max-w-[120px]">{record.customerEmail}</div>
                    </td>
                    <td className="py-2 md:py-3 px-2 md:px-4 text-muted-foreground hidden md:table-cell">
                      {record.customerEmail}
                    </td>
                    <td className="py-2 md:py-3 px-2 md:px-4 text-right font-medium whitespace-nowrap">
                      {formatCurrency(record.amount)}
                    </td>
                    <td className="py-2 md:py-3 px-2 md:px-4 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-[10px] md:text-xs">
                        {record.installmentNumber}
                      </span>
                    </td>
                    <td className="py-2 md:py-3 px-2 md:px-4 text-right text-muted-foreground whitespace-nowrap text-[10px] md:text-xs">
                      {format(record.date, 'dd/MM/yy')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          {records.length > ITEMS_PER_PAGE && (
            <div className="flex flex-col md:flex-row items-center justify-between mt-4 pt-4 border-t gap-3">
              <div className="text-xs md:text-sm text-muted-foreground">
                {startIndex + 1}-{Math.min(endIndex, records.length)} de {records.length}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className="text-xs md:text-sm h-8 md:h-9"
                >
                  <ChevronLeft className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <span className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">
                  {currentPage}/{totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="text-xs md:text-sm h-8 md:h-9"
                >
                  <span className="hidden sm:inline">Próxima</span>
                  <ChevronRight className="h-3 w-3 md:h-4 md:w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

