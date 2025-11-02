'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Calendar, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MetricCard } from '@/components/dashboard/metric-card';
import { MRRChart } from '@/components/dashboard/mrr-chart';
import { GrowthChart } from '@/components/dashboard/growth-chart';
import { RevenuePieChart } from '@/components/dashboard/revenue-pie-chart';
import { CustomerChart } from '@/components/dashboard/customer-chart';
import { NetRevenueChart } from '@/components/dashboard/net-revenue-chart';
import { DailyPayoutsChart } from '@/components/dashboard/daily-payouts-chart';
import { SubscriptionRecordsTable } from '@/components/dashboard/subscription-records-table';
import { FailedPaymentsTable } from '@/components/dashboard/failed-payments-table';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import {
  MonthlyMRR,
  CustomerTrend,
  PlanRevenue,
  ChurnMetrics,
  FinancialMetrics,
  MonthlyFinancials,
  DailyPayout,
  SubscriptionRecord,
  FailedPayment,
} from '@/lib/data-processor';
import { subMonths, isAfter } from 'date-fns';

interface DashboardData {
  mrrData: MonthlyMRR[];
  arr: number;
  churnMetrics: ChurnMetrics;
  customerTrends: CustomerTrend[];
  revenueByPlan: PlanRevenue[];
  subscriptionsCount: number;
  financialMetrics: FinancialMetrics;
  monthlyFinancials: MonthlyFinancials[];
  dailyPayouts: DailyPayout[];
  subscriptionRecords: SubscriptionRecord[];
  failedPayments: FailedPayment[];
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('all');
  const router = useRouter();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/stripe');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch data');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const filterDataByDateRange = (
    mrrData: MonthlyMRR[],
    customerData: CustomerTrend[]
  ) => {
    if (dateRange === 'all') {
      return { filteredMRR: mrrData, filteredCustomers: customerData };
    }

    const now = new Date();
    let startDate: Date;

    switch (dateRange) {
      case '3m':
        startDate = subMonths(now, 3);
        break;
      case '6m':
        startDate = subMonths(now, 6);
        break;
      case '12m':
        startDate = subMonths(now, 12);
        break;
      default:
        return { filteredMRR: mrrData, filteredCustomers: customerData };
    }

    const filteredMRR = mrrData.filter((item) => isAfter(item.monthDate, startDate));
    const filteredCustomers = customerData.filter((item) =>
      isAfter(item.monthDate, startDate)
    );

    return { filteredMRR, filteredCustomers };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-50 border-b backdrop-blur-lg bg-background/80">
          <div className="container mx-auto py-6 px-4">
            <Skeleton className="h-10 w-96 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32 mb-2" />
                  <Skeleton className="h-4 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full space-y-4 text-center">
          <div className="text-destructive text-xl font-semibold">Erro</div>
          <p className="text-muted-foreground">{error}</p>
          <div className="space-y-2 text-sm text-left bg-muted p-4 rounded-lg">
            <p className="font-semibold">Instruções de Configuração:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Crie um arquivo <code>.env.local</code> na raiz do projeto</li>
              <li>Adicione sua chave secreta do Stripe: <code>STRIPE_SECRET_KEY=sk_...</code></li>
              <li>Certifique-se de que sua conta Stripe possui dados de assinaturas</li>
              <li>Reinicie o servidor de desenvolvimento</li>
            </ol>
          </div>
          <Button onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { filteredMRR, filteredCustomers } = filterDataByDateRange(
    data.mrrData,
    data.customerTrends
  );

  // Calculate metrics from filtered data
  const latestMRR = filteredMRR[filteredMRR.length - 1]?.totalMRR || 0;
  const previousMRR = filteredMRR[filteredMRR.length - 2]?.totalMRR || 0;
  const latestNewMRR = filteredMRR[filteredMRR.length - 1]?.newMRR || 0;
  const previousNewMRR = filteredMRR[filteredMRR.length - 2]?.newMRR || 0;
  const growthRate =
    previousMRR > 0 ? ((latestMRR - previousMRR) / previousMRR) * 100 : 0;
  
  // Calculate new MRR growth rate
  const newMRRGrowthRate =
    previousNewMRR > 0 ? ((latestNewMRR - previousNewMRR) / previousNewMRR) * 100 : 0;
  
  // Calculate ARR from last 12 months
  const last12MonthsMRR = data.mrrData.slice(-12);
  const previousARR = last12MonthsMRR.slice(-13, -1).reduce((sum, m) => sum + m.totalMRR, 0);
  const currentARR = last12MonthsMRR.reduce((sum, m) => sum + m.totalMRR, 0);
  const arrGrowthRate = previousARR > 0 ? ((currentARR - previousARR) / previousARR) * 100 : 0;
  
  // Calculate customer growth
  const latestCustomers = filteredCustomers[filteredCustomers.length - 1]?.cumulativeCustomers || 0;
  const previousCustomers = filteredCustomers[filteredCustomers.length - 2]?.cumulativeCustomers || 0;
  const customerGrowth = latestCustomers - previousCustomers;

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 border-b backdrop-blur-lg bg-background/80">
        <div className="container mx-auto py-3 md:py-6 px-3 md:px-4">
          <div className="flex flex-col gap-3">
            <div className="text-center md:text-left">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">Dashboard de Receitas</h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                Análise em tempo real • {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="flex items-center gap-2 justify-center md:justify-end">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[140px] md:w-[180px] text-xs md:text-sm">
                  <Calendar className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo o Período</SelectItem>
                  <SelectItem value="3m">Últimos 3 Meses</SelectItem>
                  <SelectItem value="6m">Últimos 6 Meses</SelectItem>
                  <SelectItem value="12m">Últimos 12 Meses</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={fetchData} size="sm" className="gap-1 md:gap-2 text-xs md:text-sm">
                <RefreshCw className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
              <Button onClick={handleLogout} variant="outline" size="sm" className="gap-1 md:gap-2 text-xs md:text-sm">
                <LogOut className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics - Always Visible */}
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 md:gap-4">
          <MetricCard
            title="MRR Total"
            value={formatCurrency(latestMRR)}
            delta={growthRate !== 0 ? formatPercentage(growthRate) : undefined}
            trend={growthRate > 0 ? 'up' : growthRate < 0 ? 'down' : 'neutral'}
          />
          <MetricCard
            title="Novo MRR"
            value={formatCurrency(latestNewMRR)}
            delta={newMRRGrowthRate !== 0 ? formatPercentage(newMRRGrowthRate) : undefined}
            trend={newMRRGrowthRate > 0 ? 'up' : newMRRGrowthRate < 0 ? 'down' : 'neutral'}
          />
          <MetricCard
            title="Receita Anual"
            value={formatCurrency(data.arr)}
            delta={arrGrowthRate !== 0 ? formatPercentage(arrGrowthRate) : undefined}
            trend={arrGrowthRate > 0 ? 'up' : arrGrowthRate < 0 ? 'down' : 'neutral'}
          />
          <MetricCard
            title="Taxa de Churn"
            value={`${data.churnMetrics.churnRate.toFixed(1)}%`}
            delta={
              data.churnMetrics.churnedCount > 0
                ? `-${data.churnMetrics.churnedCount} clientes`
                : '0 cancelamentos'
            }
            trend={data.churnMetrics.churnRate > 0 ? 'down' : 'neutral'}
          />
          <MetricCard
            title="Clientes Ativos"
            value={data.churnMetrics.activeCount.toString()}
            delta={customerGrowth !== 0 ? `${customerGrowth > 0 ? '+' : ''}${customerGrowth} clientes` : undefined}
            trend={customerGrowth > 0 ? 'up' : customerGrowth < 0 ? 'down' : 'neutral'}
          />
        </div>
      </div>

      {/* Main Content - Four Tabs */}
      <div className="container mx-auto px-3 md:px-4 pb-4 md:pb-8">
        <Tabs defaultValue="revenue" className="w-full">
          <div className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0 mb-4 md:mb-8">
            <TabsList className="inline-flex lg:grid w-auto lg:w-full lg:grid-cols-4 min-w-max">
              <TabsTrigger value="revenue" className="text-xs md:text-sm whitespace-nowrap px-3 md:px-4">
                Receitas
              </TabsTrigger>
              <TabsTrigger value="financial" className="text-xs md:text-sm whitespace-nowrap px-3 md:px-4">
                Financeiro
              </TabsTrigger>
              <TabsTrigger value="banking" className="text-xs md:text-sm whitespace-nowrap px-3 md:px-4">
                Transferências
              </TabsTrigger>
              <TabsTrigger value="records" className="text-xs md:text-sm whitespace-nowrap px-3 md:px-4">
                Registros
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Aba 1: Visão Geral de Receitas */}
          <TabsContent value="revenue" className="space-y-4 md:space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
              <MRRChart data={filteredMRR} />
              <GrowthChart data={filteredMRR} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
              <RevenuePieChart data={data.revenueByPlan} />
              <CustomerChart data={filteredCustomers} />
            </div>
          </TabsContent>

          {/* Aba 2: Detalhes Financeiros */}
          <TabsContent value="financial" className="space-y-4 md:space-y-8">
            <div>
              <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Métricas de Receita</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                <Card>
                  <CardHeader className="px-3 md:px-6 py-3 md:py-4">
                    <h4 className="text-xs md:text-sm font-medium text-muted-foreground uppercase">
                      Receita Bruta
                    </h4>
                  </CardHeader>
                  <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
                    <p className="text-xl md:text-2xl font-bold">
                      {formatCurrency(data.financialMetrics.grossRevenue)}
                    </p>
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                      Total cobrado dos clientes
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="px-3 md:px-6 py-3 md:py-4">
                    <h4 className="text-xs md:text-sm font-medium text-muted-foreground uppercase">
                      Taxas de Processamento
                    </h4>
                  </CardHeader>
                  <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
                    <p className="text-xl md:text-2xl font-bold">
                      {formatCurrency(data.financialMetrics.stripeFees)}
                    </p>
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                      {data.financialMetrics.feePercentage.toFixed(2)}% taxa efetiva
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="px-3 md:px-6 py-3 md:py-4">
                    <h4 className="text-xs md:text-sm font-medium text-muted-foreground uppercase">
                      Receita Líquida
                    </h4>
                  </CardHeader>
                  <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
                    <p className="text-xl md:text-2xl font-bold text-green-600">
                      {formatCurrency(data.financialMetrics.netRevenue)}
                    </p>
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                      Após taxas do Stripe
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <NetRevenueChart data={data.monthlyFinancials} />
          </TabsContent>

          {/* Aba 3: Transferências Bancárias */}
          <TabsContent value="banking" className="space-y-4 md:space-y-8">
            <div>
              <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Status de Transferências</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                <Card>
                  <CardHeader className="px-3 md:px-6 py-3 md:py-4">
                    <h4 className="text-xs md:text-sm font-medium text-muted-foreground uppercase">
                      Transferências Bancárias
                    </h4>
                  </CardHeader>
                  <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
                    <p className="text-xl md:text-2xl font-bold">
                      {formatCurrency(data.financialMetrics.totalPayouts)}
                    </p>
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                      Enviado para conta bancária
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="px-3 md:px-6 py-3 md:py-4">
                    <h4 className="text-xs md:text-sm font-medium text-muted-foreground uppercase">
                      Saldo Disponível
                    </h4>
                  </CardHeader>
                  <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
                    <p className="text-xl md:text-2xl font-bold">
                      {formatCurrency(data.financialMetrics.availableBalance)}
                    </p>
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                      Pronto para saque
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="px-3 md:px-6 py-3 md:py-4">
                    <h4 className="text-xs md:text-sm font-medium text-muted-foreground uppercase">
                      Saldo Pendente
                    </h4>
                  </CardHeader>
                  <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
                    <p className="text-xl md:text-2xl font-bold">
                      {formatCurrency(data.financialMetrics.pendingBalance)}
                    </p>
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                      Em processamento
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <DailyPayoutsChart data={data.dailyPayouts} />
          </TabsContent>

          {/* Aba 4: Registros e Inadimplência */}
          <TabsContent value="records" className="space-y-4 md:space-y-8">
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
                <Card>
                  <CardHeader className="px-3 md:px-6 py-3 md:py-4">
                    <h4 className="text-xs md:text-sm font-medium text-muted-foreground uppercase">
                      Total de Assinaturas Pagas
                    </h4>
                  </CardHeader>
                  <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
                    <p className="text-xl md:text-2xl font-bold text-green-600">
                      {data.subscriptionRecords.length}
                    </p>
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                      Últimos 12 meses
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-red-200">
                  <CardHeader className="px-3 md:px-6 py-3 md:py-4">
                    <h4 className="text-xs md:text-sm font-medium text-muted-foreground uppercase">
                      Pagamentos com Falha
                    </h4>
                  </CardHeader>
                  <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
                    <p className="text-xl md:text-2xl font-bold text-red-600">
                      {data.failedPayments.length}
                    </p>
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                      {data.failedPayments.length > 0 
                        ? `${((data.failedPayments.length / (data.subscriptionRecords.length + data.failedPayments.length)) * 100).toFixed(1)}% taxa de falha`
                        : 'Sem falhas no período'
                      }
                    </p>
                  </CardContent>
                </Card>
              </div>

              <SubscriptionRecordsTable records={data.subscriptionRecords} />
            </div>

            <FailedPaymentsTable payments={data.failedPayments} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Rodapé */}
      <div className="border-t mt-6 md:mt-12">
        <div className="container mx-auto py-4 md:py-6 px-3 md:px-4 text-center text-xs md:text-sm text-muted-foreground">
          <span className="hidden sm:inline">Fonte de Dados: Stripe API | {data.subscriptionsCount} assinaturas monitoradas</span>
          <span className="sm:hidden">{data.subscriptionsCount} assinaturas</span>
        </div>
      </div>
    </div>
  );
}
