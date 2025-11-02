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
    const mrrData = processor.calculateNewVsExistingMRR(subscriptions);
    const arr = processor.calculateARR(subscriptions);
    const churnMetrics = processor.calculateChurnMetrics(subscriptions);
    const customerTrends = processor.calculateCustomerTrends(subscriptions);
    const revenueByPlan = processor.calculateRevenueByPlan(subscriptions, productNames);
    
    // Process financial metrics
    const financialMetrics = processor.calculateFinancialMetrics(
      balanceTransactions,
      payouts,
      balance
    );
    const monthlyFinancials = processor.calculateMonthlyFinancials(
      balanceTransactions,
      payouts
    );
    const dailyPayouts = processor.calculateDailyPayouts(payouts);
    const subscriptionRecords = processor.processSubscriptionRecords(invoices);
    const failedPayments = processor.processFailedPayments(invoices);

    return NextResponse.json({
      mrrData,
      arr,
      churnMetrics,
      customerTrends,
      revenueByPlan,
      subscriptionsCount: subscriptions.length,
      financialMetrics,
      monthlyFinancials,
      dailyPayouts,
      subscriptionRecords,
      failedPayments,
    });
  } catch (error) {
    console.error('Error fetching Stripe data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data from Stripe. Please check your API key.' },
      { status: 500 }
    );
  }
}

