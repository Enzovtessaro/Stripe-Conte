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

export async function GET() {
  try {
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

    return NextResponse.json(
      {
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
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching Stripe data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data from Stripe. Please check your API key.' },
      { status: 500 }
    );
  }
}

