import Stripe from 'stripe';
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns';

export interface MonthlyMRR {
  month: string;
  monthDate: Date;
  newMRR: number;
  existingMRR: number;
  totalMRR: number;
}

export interface CustomerTrend {
  month: string;
  monthDate: Date;
  newCustomers: number;
  cumulativeCustomers: number;
}

export interface PlanRevenue {
  plan: string;
  mrr: number;
  percentage: number;
}

export interface ChurnMetrics {
  churnRate: number;
  churnedCount: number;
  activeCount: number;
  previousActiveCount: number;
}

export interface FinancialMetrics {
  grossRevenue: number;
  stripeFees: number;
  netRevenue: number;
  totalPayouts: number;
  pendingBalance: number;
  availableBalance: number;
  feePercentage: number;
}

export interface MonthlyFinancials {
  month: string;
  monthDate: Date;
  grossRevenue: number;
  stripeFees: number;
  netRevenue: number;
  payouts: number;
}

export interface DailyPayout {
  date: string;
  dateObj: Date;
  amount: number;
  count: number;
  stripeAmount?: number;
  stripeCount?: number;
  pixAmount?: number;
  pixCount?: number;
}

export interface SubscriptionRecord {
  customerName: string;
  customerEmail: string;
  amount: number;
  date: Date;
  installmentNumber: number;
  invoiceId: string;
}

export interface FailedPayment {
  customerName: string;
  customerEmail: string;
  amount: number;
  attemptDate: Date;
  installmentNumber: number;
  invoiceId: string;
  failureReason?: string;
}

export class DataProcessor {
  calculateSubscriptionMRR(subscription: Stripe.Subscription): number {
    let totalMRR = 0;

    for (const item of subscription.items.data) {
      const price = item.price;
      const quantity = item.quantity || 1;

      if (!price || !price.recurring) {
        continue;
      }

      const unitAmount = (price.unit_amount || 0) / 100; // Convert from cents
      const interval = price.recurring.interval;
      const intervalCount = price.recurring.interval_count || 1;

      let monthlyAmount = 0;

      switch (interval) {
        case 'month':
          monthlyAmount = unitAmount / intervalCount;
          break;
        case 'year':
          monthlyAmount = unitAmount / (12 * intervalCount);
          break;
        case 'week':
          monthlyAmount = (unitAmount * 52) / (12 * intervalCount);
          break;
        case 'day':
          monthlyAmount = (unitAmount * 365) / (12 * intervalCount);
          break;
      }

      totalMRR += monthlyAmount * quantity;
    }

    return Math.round(totalMRR * 100) / 100;
  }

  calculateNewVsExistingMRR(subscriptions: Stripe.Subscription[]): MonthlyMRR[] {
    if (subscriptions.length === 0) return [];

    const subscriptionData = subscriptions
      .map((sub) => {
        const createdDate = new Date(sub.created * 1000);
        const canceledDate = sub.canceled_at ? new Date(sub.canceled_at * 1000) : null;
        const mrr = this.calculateSubscriptionMRR(sub);

        return {
          id: sub.id,
          createdDate,
          canceledDate,
          status: sub.status,
          mrr,
        };
      })
      .filter((sub) => sub.mrr > 0);

    // Collect all relevant months
    const monthsSet = new Set<string>();
    
    for (const sub of subscriptionData) {
      const createdMonth = startOfMonth(sub.createdDate);
      monthsSet.add(createdMonth.toISOString());

      if (sub.canceledDate) {
        const canceledMonth = startOfMonth(sub.canceledDate);
        let current = createdMonth;
        while (current <= canceledMonth) {
          monthsSet.add(current.toISOString());
          current = addMonths(current, 1);
        }
      } else {
        let current = createdMonth;
        const now = startOfMonth(new Date());
        while (current <= now) {
          monthsSet.add(current.toISOString());
          current = addMonths(current, 1);
        }
      }
    }

    const months = Array.from(monthsSet)
      .map((m) => new Date(m))
      .sort((a, b) => a.getTime() - b.getTime());

    const results: MonthlyMRR[] = [];

    for (const month of months) {
      const monthEnd = endOfMonth(month);
      let newMRR = 0;
      let existingMRR = 0;

      for (const sub of subscriptionData) {
        const isActiveInMonth =
          sub.createdDate <= monthEnd &&
          (!sub.canceledDate || sub.canceledDate >= month);

        if (isActiveInMonth) {
          const createdMonth = startOfMonth(sub.createdDate);
          if (createdMonth.getTime() === month.getTime()) {
            newMRR += sub.mrr;
          } else {
            existingMRR += sub.mrr;
          }
        }
      }

      results.push({
        month: format(month, 'MMM yyyy'),
        monthDate: month,
        newMRR: Math.round(newMRR * 100) / 100,
        existingMRR: Math.round(existingMRR * 100) / 100,
        totalMRR: Math.round((newMRR + existingMRR) * 100) / 100,
      });
    }

    return results;
  }

  calculateARR(subscriptions: Stripe.Subscription[]): number {
    let totalARR = 0;

    for (const sub of subscriptions) {
      if (sub.status === 'active' || sub.status === 'trialing') {
        const mrr = this.calculateSubscriptionMRR(sub);
        totalARR += mrr * 12;
      }
    }

    return Math.round(totalARR * 100) / 100;
  }

  calculateChurnMetrics(subscriptions: Stripe.Subscription[]): ChurnMetrics {
    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now);

    let activeStartOfMonth = 0;
    let activeCurrent = 0;
    let churnedThisMonth = 0;

    for (const sub of subscriptions) {
      const createdDate = new Date(sub.created * 1000);
      const canceledDate = sub.canceled_at ? new Date(sub.canceled_at * 1000) : null;

      const wasActiveAtMonthStart =
        createdDate < startOfCurrentMonth &&
        (!canceledDate || canceledDate >= startOfCurrentMonth);

      const isActiveNow =
        createdDate < now && (!canceledDate || canceledDate >= now);

      if (wasActiveAtMonthStart) {
        activeStartOfMonth++;

        if (
          !isActiveNow &&
          canceledDate &&
          canceledDate >= startOfCurrentMonth &&
          canceledDate < now
        ) {
          churnedThisMonth++;
        }
      }

      if (isActiveNow) {
        activeCurrent++;
      }
    }

    const churnRate =
      activeStartOfMonth > 0
        ? (churnedThisMonth / activeStartOfMonth) * 100
        : 0;

    return {
      churnRate: Math.round(churnRate * 100) / 100,
      churnedCount: churnedThisMonth,
      activeCount: activeCurrent,
      previousActiveCount: activeStartOfMonth,
    };
  }

  calculateCustomerTrends(subscriptions: Stripe.Subscription[]): CustomerTrend[] {
    const monthlyCustomers = new Map<string, Set<string>>();

    for (const sub of subscriptions) {
      const createdDate = new Date(sub.created * 1000);
      const monthKey = format(startOfMonth(createdDate), 'yyyy-MM');
      
      if (!monthlyCustomers.has(monthKey)) {
        monthlyCustomers.set(monthKey, new Set());
      }
      
      monthlyCustomers.get(monthKey)!.add(sub.customer as string);
    }

    const sortedMonths = Array.from(monthlyCustomers.keys()).sort();
    let cumulative = 0;

    return sortedMonths.map((monthKey) => {
      const monthDate = new Date(monthKey + '-01');
      const newCustomers = monthlyCustomers.get(monthKey)!.size;
      cumulative += newCustomers;

      return {
        month: format(monthDate, 'MMM yyyy'),
        monthDate,
        newCustomers,
        cumulativeCustomers: cumulative,
      };
    });
  }

  calculateRevenueByPlan(
    subscriptions: Stripe.Subscription[],
    productNames: Record<string, string> = {}
  ): PlanRevenue[] {
    const planMRR = new Map<string, number>();

    for (const sub of subscriptions) {
      if (sub.status !== 'active' && sub.status !== 'trialing') {
        continue;
      }

      for (const item of sub.items.data) {
        const price = item.price;
        const product = price.product;
        
        let productName = 'Unknown Product';
        
        if (typeof product === 'string') {
          productName = productNames[product] || product;
        } else if (product && typeof product === 'object' && 'name' in product) {
          productName = product.name || 'Unknown Product';
        }

        const mrr = this.calculateSubscriptionMRR({
          ...sub,
          items: { data: [item], has_more: false, object: 'list', url: '' },
        });

        planMRR.set(productName, (planMRR.get(productName) || 0) + mrr);
      }
    }

    const totalMRR = Array.from(planMRR.values()).reduce((sum, mrr) => sum + mrr, 0);

    return Array.from(planMRR.entries())
      .map(([plan, mrr]) => ({
        plan,
        mrr: Math.round(mrr * 100) / 100,
        percentage: Math.round((mrr / totalMRR) * 10000) / 100,
      }))
      .sort((a, b) => b.mrr - a.mrr);
  }

  calculateFinancialMetrics(
    balanceTransactions: Stripe.BalanceTransaction[],
    payouts: Stripe.Payout[],
    balance: Stripe.Balance
  ): FinancialMetrics {
    let grossRevenue = 0;
    let stripeFees = 0;

    // Calculate from balance transactions
    for (const txn of balanceTransactions) {
      if (txn.type === 'charge' || txn.type === 'payment') {
        grossRevenue += txn.amount / 100; // Convert from cents
        stripeFees += txn.fee / 100;
      }
    }

    const netRevenue = grossRevenue - stripeFees;
    
    const totalPayouts = payouts
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + (p.amount / 100), 0);

    const availableBalance = balance.available
      .reduce((sum, b) => sum + b.amount, 0) / 100;

    const pendingBalance = balance.pending
      .reduce((sum, b) => sum + b.amount, 0) / 100;

    const feePercentage = grossRevenue > 0 ? (stripeFees / grossRevenue) * 100 : 0;

    return {
      grossRevenue: Math.round(grossRevenue * 100) / 100,
      stripeFees: Math.round(stripeFees * 100) / 100,
      netRevenue: Math.round(netRevenue * 100) / 100,
      totalPayouts: Math.round(totalPayouts * 100) / 100,
      pendingBalance: Math.round(pendingBalance * 100) / 100,
      availableBalance: Math.round(availableBalance * 100) / 100,
      feePercentage: Math.round(feePercentage * 100) / 100,
    };
  }

  calculateMonthlyFinancials(
    balanceTransactions: Stripe.BalanceTransaction[],
    payouts: Stripe.Payout[]
  ): MonthlyFinancials[] {
    const monthlyData = new Map<string, {
      gross: number;
      fees: number;
      payouts: number;
    }>();

    // Process balance transactions
    for (const txn of balanceTransactions) {
      if (txn.type === 'charge' || txn.type === 'payment') {
        const date = new Date(txn.created * 1000);
        const monthKey = format(startOfMonth(date), 'yyyy-MM');
        
        const existing = monthlyData.get(monthKey) || { gross: 0, fees: 0, payouts: 0 };
        existing.gross += txn.amount / 100;
        existing.fees += txn.fee / 100;
        monthlyData.set(monthKey, existing);
      }
    }

    // Process payouts
    for (const payout of payouts) {
      if (payout.status === 'paid' && payout.arrival_date) {
        const date = new Date(payout.arrival_date * 1000);
        const monthKey = format(startOfMonth(date), 'yyyy-MM');
        
        const existing = monthlyData.get(monthKey) || { gross: 0, fees: 0, payouts: 0 };
        existing.payouts += payout.amount / 100;
        monthlyData.set(monthKey, existing);
      }
    }

    // Convert to array and sort
    const results: MonthlyFinancials[] = [];
    for (const [monthKey, data] of Array.from(monthlyData.entries())) {
      const monthDate = new Date(monthKey + '-01');
      results.push({
        month: format(monthDate, 'MMM yyyy'),
        monthDate,
        grossRevenue: Math.round(data.gross * 100) / 100,
        stripeFees: Math.round(data.fees * 100) / 100,
        netRevenue: Math.round((data.gross - data.fees) * 100) / 100,
        payouts: Math.round(data.payouts * 100) / 100,
      });
    }

    return results.sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime());
  }

  calculateDailyPayouts(payouts: Stripe.Payout[]): DailyPayout[] {
    const dailyData = new Map<
      string,
      { amount: number; count: number; stripeAmount: number; stripeCount: number }
    >();

    // Process payouts by arrival date
    for (const payout of payouts) {
      if (payout.status === 'paid' && payout.arrival_date) {
        const date = new Date(payout.arrival_date * 1000);
        const dateKey = format(date, 'yyyy-MM-dd');
        
        const existing =
          dailyData.get(dateKey) || { amount: 0, count: 0, stripeAmount: 0, stripeCount: 0 };
        const payoutAmount = payout.amount / 100;
        existing.amount += payoutAmount;
        existing.count += 1;
        existing.stripeAmount += payoutAmount;
        existing.stripeCount += 1;
        dailyData.set(dateKey, existing);
      }
    }

    // Convert to array and sort
    const results: DailyPayout[] = [];
    for (const [dateKey, data] of Array.from(dailyData.entries())) {
      const dateObj = new Date(dateKey);
      results.push({
        date: format(dateObj, 'dd/MM/yyyy'),
        dateObj,
        amount: Math.round(data.amount * 100) / 100,
        count: data.count,
        stripeAmount: Math.round(data.stripeAmount * 100) / 100,
        stripeCount: data.stripeCount,
        pixAmount: 0,
        pixCount: 0,
      });
    }

    return results.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }

  processSubscriptionRecords(invoices: Stripe.Invoice[]): SubscriptionRecord[] {
    const records: SubscriptionRecord[] = [];
    const customerPaymentCounts = new Map<string, number>();

    // Sort invoices by date to count installments correctly
    const sortedInvoices = [...invoices]
      .filter((inv) => inv.status === 'paid' && inv.subscription)
      .sort((a, b) => (a.created || 0) - (b.created || 0));

    for (const invoice of sortedInvoices) {
      const customer = invoice.customer as Stripe.Customer | string;
      const customerId = typeof customer === 'string' ? customer : customer.id;
      const customerName = typeof customer === 'object' ? (customer.name || 'N/A') : 'N/A';
      const customerEmail = typeof customer === 'object' ? (customer.email || 'N/A') : 'N/A';

      // Increment installment count for this customer
      const currentCount = customerPaymentCounts.get(customerId) || 0;
      customerPaymentCounts.set(customerId, currentCount + 1);

      records.push({
        customerName,
        customerEmail,
        amount: (invoice.amount_paid || 0) / 100,
        date: new Date((invoice.status_transitions?.paid_at || invoice.created) * 1000),
        installmentNumber: currentCount + 1,
        invoiceId: invoice.id,
      });
    }

    return records.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  processFailedPayments(invoices: Stripe.Invoice[]): FailedPayment[] {
    const failures: FailedPayment[] = [];
    const customerPaymentCounts = new Map<string, number>();

    // First, count all successful payments per customer to know installment numbers
    const allInvoicesSorted = [...invoices]
      .filter((inv) => inv.subscription)
      .sort((a, b) => (a.created || 0) - (b.created || 0));

    for (const invoice of allInvoicesSorted) {
      const customer = invoice.customer as Stripe.Customer | string;
      const customerId = typeof customer === 'string' ? customer : customer.id;

      if (invoice.status === 'paid') {
        const currentCount = customerPaymentCounts.get(customerId) || 0;
        customerPaymentCounts.set(customerId, currentCount + 1);
      }
    }

    // Now process failed invoices
    const failedInvoices = invoices.filter(
      (inv) =>
        inv.subscription &&
        (inv.status === 'open' || inv.status === 'uncollectible') &&
        inv.attempted &&
        !inv.paid
    );

    for (const invoice of failedInvoices) {
      const customer = invoice.customer as Stripe.Customer | string;
      const customerId = typeof customer === 'string' ? customer : customer.id;
      const customerName = typeof customer === 'object' ? (customer.name || 'N/A') : 'N/A';
      const customerEmail = typeof customer === 'object' ? (customer.email || 'N/A') : 'N/A';

      // Estimate installment number (count of paid + 1 for this failed attempt)
      const installmentNumber = (customerPaymentCounts.get(customerId) || 0) + 1;

      failures.push({
        customerName,
        customerEmail,
        amount: (invoice.amount_due || 0) / 100,
        attemptDate: new Date(
          (invoice.status_transitions?.finalized_at || invoice.created) * 1000
        ),
        installmentNumber,
        invoiceId: invoice.id,
        failureReason: invoice.last_finalization_error?.message || 'Pagamento falhou',
      });
    }

    return failures.sort((a, b) => b.attemptDate.getTime() - a.attemptDate.getTime());
  }
}

