'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type ReconciliationStatus = 'pago' | 'aguardando' | 'nao_pago' | 'sem_cobranca';

interface ReconciliationRow {
  clientId: string;
  companyName: string | null;
  email: string;
  amount: number;
  method: 'pix' | 'cartao';
  dueDay: number | null;
  status: ReconciliationStatus;
  paidAt: string | null;
  // Assinatura ativa cujo ciclo ainda nao virou: a data em que cobra.
  nextChargeAt?: string | null;
  // Coberta pela assinatura de outra empresa, no mesmo pagador.
  sharedSubscriptionWith?: string | null;
}

interface ReconciliationSummary {
  total: number;
  pago: number;
  aguardando: number;
  naoPago: number;
  semCobranca: number;
  valorPago: number;
  valorEsperado: number;
}

const brl = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Quatro estados distintos: antes do vencimento nao ha atraso, e "sem cobranca"
// (venceu e nao foi nem gerada) e um problema diferente de cobranca em aberto.
const STATUS_LABEL: Record<ReconciliationStatus, string> = {
  pago: 'Pago',
  aguardando: 'Aguardando',
  nao_pago: 'Não pago',
  sem_cobranca: 'Sem cobrança gerada',
};

const STATUS_CLASS: Record<ReconciliationStatus, string> = {
  pago: 'bg-green-100 text-green-800 hover:bg-green-100',
  aguardando: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
  nao_pago: 'bg-red-100 text-red-800 hover:bg-red-100',
  sem_cobranca: 'bg-amber-100 text-amber-900 hover:bg-amber-100',
};

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function buildMonthOptions(count = 12) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${date.getFullYear()}-${date.getMonth() + 1}`,
      label: `${MONTHS[date.getMonth()]} ${date.getFullYear()}`,
    };
  });
}

export function ReconciliationTable() {
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const [selected, setSelected] = useState(monthOptions[0].value);
  const [statusFilter, setStatusFilter] = useState<'todos' | ReconciliationStatus>('todos');
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const [year, month] = selected.split('-');
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetch(`/api/reconciliation?month=${month}&year=${year}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error ?? 'Falha ao carregar');
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        setRows(payload.rows ?? []);
        setSummary(payload.summary ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Falha ao carregar');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  const visibleRows = useMemo(() => {
    const filtered =
      statusFilter === 'todos' ? rows : rows.filter((row) => row.status === statusFilter);

    // Por dia de vencimento crescente: e a ordem em que a cobranca acontece no
    // mes. Sem dia cadastrado vai para o fim, senao apareceria como se vencesse
    // no dia 1. Empate resolve por empresa, para a ordem nao variar entre cargas.
    return [...filtered].sort((a, b) => {
      const dayA = a.dueDay ?? Number.POSITIVE_INFINITY;
      const dayB = b.dueDay ?? Number.POSITIVE_INFINITY;
      if (dayA !== dayB) return dayA - dayB;
      return (a.companyName ?? '').localeCompare(b.companyName ?? '', 'pt-BR');
    });
  }, [rows, statusFilter]);

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Conciliação Mensal</CardTitle>
          {summary && !loading && (
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              {brl(summary.valorPago)} recebidos de {brl(summary.valorEsperado)} esperados ·{' '}
              {summary.pago} de {summary.total} clientes
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[150px] text-xs md:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="aguardando">Aguardando</SelectItem>
              <SelectItem value="nao_pago">Não pago</SelectItem>
              <SelectItem value="sem_cobranca">Sem cobrança</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-[150px] text-xs md:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {summary && !loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
            {([
              ['pago', summary.pago],
              ['aguardando', summary.aguardando],
              ['nao_pago', summary.naoPago],
              ['sem_cobranca', summary.semCobranca],
            ] as Array<[ReconciliationStatus, number]>).map(([status, count]) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(statusFilter === status ? 'todos' : status)}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  statusFilter === status ? 'border-foreground' : 'border-border hover:border-foreground/40'
                }`}
              >
                <p className="text-xs text-muted-foreground">{STATUS_LABEL[status]}</p>
                <p className="text-lg md:text-xl font-bold">{count}</p>
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Empresa</th>
                  <th className="py-2 pr-3 font-medium">E-mail</th>
                  <th className="py-2 pr-3 font-medium text-right">Mensalidade</th>
                  <th className="py-2 pr-3 font-medium">Modalidade</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Vencimento</th>
                  <th className="py-2 font-medium">Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.clientId} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 pr-3 font-medium">{row.companyName ?? '—'}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.email}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{brl(row.amount)}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className="font-normal">
                        {row.method === 'cartao' ? 'Cartão' : 'PIX'}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge className={`font-normal ${STATUS_CLASS[row.status]}`}>
                        {STATUS_LABEL[row.status]}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                      {row.dueDay ? `dia ${row.dueDay}` : '—'}
                    </td>
                    <td className="py-2 tabular-nums text-muted-foreground">
                      {row.paidAt ? (
                        <>
                          {new Date(row.paidAt).toLocaleDateString('pt-BR')}
                          {row.sharedSubscriptionWith && (
                            <span
                              className="block text-[10px] not-italic text-muted-foreground/80"
                              title={`Assinatura compartilhada com ${row.sharedSubscriptionWith}`}
                            >
                              via {row.sharedSubscriptionWith}
                            </span>
                          )}
                        </>
                      ) : row.nextChargeAt ? (
                        // Sem isso, "aguardando" parecia problema em vez de
                        // cobranca marcada para uma data adiante.
                        <span className="text-muted-foreground/80">
                          cobra {new Date(row.nextChargeAt).toLocaleDateString('pt-BR')}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {visibleRows.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum cliente neste filtro.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
