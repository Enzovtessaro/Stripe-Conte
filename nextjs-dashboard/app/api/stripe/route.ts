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
    
    const pixMetrics = getPixMetrics();

    const mrrData = mergeMRRData(stripeMRR, pixMetrics.mrrData);
    const customerTrends = mergeCustomerTrends(stripeCustomerTrends, pixMetrics.customerTrends);
    const revenueByPlan = mergeRevenueByPlan(stripeRevenueByPlan, pixMetrics.revenueByPlan);
    const churnMetrics = mergeChurnMetrics(stripeChurn, pixMetrics.churnSnapshot);
    const arr = Math.round((stripeARR + pixMetrics.arr) * 100) / 100;
    const totalSubscriptionsCount = subscriptions.length + pixMetrics.totalSubscriptions;
    
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
      financialMetricsStripe,
      pixMetrics.financialMetrics
    );
    const monthlyFinancials = mergeMonthlyFinancials(
      monthlyFinancialsStripe,
      pixMetrics.monthlyFinancials
    );
    const dailyPayouts = mergeDailyPayouts(dailyPayoutsStripe, pixMetrics.dailyPayouts);
    const subscriptionRecords = mergeSubscriptionRecords(
      subscriptionRecordsStripe,
      pixMetrics.subscriptionRecords
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

