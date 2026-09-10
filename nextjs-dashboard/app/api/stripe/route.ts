import { NextResponse } from 'next/server';
import { 
  getSubscriptions, 
  getProducts, 
  getBalanceTransactions,
  getPayouts,
  getCurrentBalance,
  getInvoices 
} from '@/lib/stripe';
import { DataProcessor } from '@/lib/data-processor';
import { subMonths } from 'date-fns';
import { getPixMetrics } from '@/lib/pix-processor';
import { getAbacateData } from '@/lib/abacate';
import { getAbacateMetrics, getFirstPaidDate } from '@/lib/abacate-processor';
import { getChargeIdentities } from '@/lib/conte-identities';
import {
  mergeChurnMetrics,
  mergeCustomerTrends,
  mergeDailyPayouts,
  mergeFinancialMetrics,
  mergeMonthlyFinancials,
  mergeMRRData,
  mergeRevenueByPlan,
  mergeSubscriptionRecords,
} from '@/lib/metrics-merger';

// Force dynamic rendering and disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Montar a resposta custa 35-55s: 12 meses de balance transactions e invoices
// do Stripe, mais o historico do Abacate. A pagina ainda chama a rota duas
// vezes, entao sem cache um carregamento levava ~90s e parecia travado.
// 60s mantem o numero fresco e faz o segundo acesso ser instantaneo.
const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

const RESPONSE_TTL_MS = 60_000;
let responseCache: { at: number; body: unknown } | null = null;

export async function GET() {
  try {
    if (responseCache && Date.now() - responseCache.at < RESPONSE_TTL_MS) {
      return NextResponse.json(responseCache.body, { headers: NO_STORE_HEADERS });
    }

    // Fetch subscriptions from Stripe
    const subscriptions = await getSubscriptions();

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { error: 'No subscription data found in your Stripe account.' },
        { status: 404 }
      );
    }

    // Collect unique product IDs
    const productIds = new Set<string>();
    for (const sub of subscriptions) {
      for (const item of sub.items.data) {
        const product = item.price.product;
        if (typeof product === 'string') {
          productIds.add(product);
        }
      }
    }

    // Fetch product names
    const productNames = await getProducts(Array.from(productIds));

    // Fetch financial data (last 12 months)
    const startDate = subMonths(new Date(), 12);
    const [balanceTransactions, payouts, balance, invoices] = await Promise.all([
      getBalanceTransactions(startDate),
      getPayouts(startDate),
      getCurrentBalance(),
      getInvoices(startDate),
    ]);

    // Process the data
    const processor = new DataProcessor();
    const stripeMRR = processor.calculateNewVsExistingMRR(subscriptions);
    const stripeARR = processor.calculateARR(subscriptions);
    const stripeChurn = processor.calculateChurnMetrics(subscriptions);
    const stripeCustomerTrends = processor.calculateCustomerTrends(subscriptions);
    const stripeRevenueByPlan = processor.calculateRevenueByPlan(subscriptions, productNames);
    
    // Abacate Pay is the live source for PIX. The manual records in
    // data/pix-subscriptions.json only cover the period before Abacate had data,
    // so the same customer is never counted on both sides.
    // As identidades vêm do backoffice do Conte: o Abacate não devolve cliente
    // nem plano ao listar as cobranças. Sem elas as métricas por cliente ficam
    // de fora em vez de saírem erradas.
    const [abacate, identities] = await Promise.all([
      getAbacateData(),
      getChargeIdentities(),
    ]);
    const abacateCutoff = getFirstPaidDate(abacate.charges);

    const pixMetrics = getPixMetrics(new Date(), abacateCutoff);
    const abacateMetrics = getAbacateMetrics(
      abacate.charges,
      abacate.customers,
      new Date(),
      pixMetrics.customerNames,
      identities
    );

    const pixMRR = mergeMRRData(pixMetrics.mrrData, abacateMetrics.mrrData);
    const pixCustomerTrends = mergeCustomerTrends(
      pixMetrics.customerTrends,
      abacateMetrics.customerTrends
    );
    const pixRevenueByPlan = mergeRevenueByPlan(
      pixMetrics.revenueByPlan,
      abacateMetrics.revenueByPlan
    );

    // Stripe e PIX agora sao os dois run-rate, entao o mes corrente ja vem
    // completo e nao precisa de marca de parcial.
    const mrrData = mergeMRRData(stripeMRR, pixMRR);
    const customerTrends = mergeCustomerTrends(stripeCustomerTrends, pixCustomerTrends);
    const revenueByPlan = mergeRevenueByPlan(stripeRevenueByPlan, pixRevenueByPlan);
    const churnMetrics = mergeChurnMetrics(stripeChurn, {
      activeCount: pixMetrics.churnSnapshot.activeCount + abacateMetrics.churnSnapshot.activeCount,
      inactiveCount:
        pixMetrics.churnSnapshot.inactiveCount + abacateMetrics.churnSnapshot.inactiveCount,
    });
    const arr = Math.round((stripeARR + pixMetrics.arr + abacateMetrics.arr) * 100) / 100;
    const totalSubscriptionsCount =
      subscriptions.length + pixMetrics.totalSubscriptions + abacateMetrics.totalSubscriptions;
    
    // Process financial metrics
    const financialMetricsStripe = processor.calculateFinancialMetrics(
      balanceTransactions,
      payouts,
      balance
    );
    const monthlyFinancialsStripe = processor.calculateMonthlyFinancials(
      balanceTransactions,
      payouts
    );
    const dailyPayoutsStripe = processor.calculateDailyPayouts(payouts);
    const subscriptionRecordsStripe = processor.processSubscriptionRecords(invoices);
    const failedPayments = processor.processFailedPayments(invoices);
    
    const financialMetrics = mergeFinancialMetrics(
      mergeFinancialMetrics(financialMetricsStripe, pixMetrics.financialMetrics),
      abacateMetrics.financialMetrics
    );
    const monthlyFinancials = mergeMonthlyFinancials(
      monthlyFinancialsStripe,
      mergeMonthlyFinancials(pixMetrics.monthlyFinancials, abacateMetrics.monthlyFinancials)
    );
    // Both PIX sources share the same series in the chart, so they are tagged together.
    const dailyPayouts = mergeDailyPayouts(dailyPayoutsStripe, [
      ...pixMetrics.dailyPayouts,
      ...abacateMetrics.dailyPayouts,
    ]);
    const subscriptionRecords = mergeSubscriptionRecords(
      subscriptionRecordsStripe,
      mergeSubscriptionRecords(pixMetrics.subscriptionRecords, abacateMetrics.subscriptionRecords)
    );

    const body = {
        mrrData,
        arr,
        churnMetrics,
        customerTrends,
        revenueByPlan,
        subscriptionsCount: totalSubscriptionsCount,
        financialMetrics,
        monthlyFinancials,
        dailyPayouts,
        subscriptionRecords,
        failedPayments,
        // Quando false, o PIX da Abacate nao entrou nos totais. A tela precisa
        // avisar: um total incompleto passando por completo e pior que um erro.
        pixAvailable: abacate.available,
        // Cobrancas avulsas (renovacao de certificado): receita real, mas nao
        // assinatura — por isso vao separadas do MRR recorrente.
        oneOffRevenue: {
          monthly: abacateMetrics.oneOffMonthly,
          total: abacateMetrics.oneOffTotal,
          last12Months: abacateMetrics.oneOffLast12Months,
        },
    };

    // Resposta sem o PIX nao vira cache: a proxima visita tenta de novo em vez
    // de repetir por um minuto um total que esta incompleto.
    if (abacate.available) {
      responseCache = { at: Date.now(), body };
    }

    return NextResponse.json(body, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('Error fetching Stripe data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data from Stripe. Please check your API key.' },
      { status: 500 }
    );
  }
}

