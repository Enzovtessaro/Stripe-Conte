import { addMonths, format, parseISO, startOfMonth } from 'date-fns';
import type {
  CustomerTrend,
  DailyPayout,
  FinancialMetrics,
  MonthlyFinancials,
  MonthlyMRR,
  PlanRevenue,
  SubscriptionRecord,
} from './data-processor';
import pixSubscriptionsData from '@/data/pix-subscriptions.json';

interface PixSubscription {
  customerName: string;
  planType: string;
  amount: number;
  startDate: string;
  active: boolean;
  id: string;
  createdAt: string;
}

interface PixChurnSnapshot {
  activeCount: number;
  inactiveCount: number;
}

export interface PixMetrics {
  mrrData: MonthlyMRR[];
  customerTrends: CustomerTrend[];
  revenueByPlan: PlanRevenue[];
  churnSnapshot: PixChurnSnapshot;
  arr: number;
  totalSubscriptions: number;
  dailyPayouts: DailyPayout[];
  monthlyFinancials: MonthlyFinancials[];
  financialMetrics: FinancialMetrics;
  subscriptionRecords: SubscriptionRecord[];
}

const pixSubscriptions = pixSubscriptionsData as PixSubscription[];

const MONTH_FORMAT = 'yyyy-MM';

export function getPixMetrics(referenceDate: Date = new Date()): PixMetrics {
  const monthMap = new Map<string, { monthDate: Date; newMRR: number; existingMRR: number }>();
  const customerMonthMap = new Map<string, number>();
  const planMap = new Map<string, number>();
  const dailyMap = new Map<string, { date: Date; amount: number; count: number }>();
  const monthlyFinancialMap = new Map<
    string,
    { monthDate: Date; gross: number; fees: number; payouts: number }
  >();
  const subscriptionRecords: SubscriptionRecord[] = [];

  let arr = 0;
  let activeCount = 0;
  let inactiveCount = 0;
  let grossRevenue = 0;

  for (const subscription of pixSubscriptions) {
    const isActive = subscription.active;
    const startDate = parseISO(subscription.startDate);

    if (isActive) {
      activeCount += 1;
      arr += subscription.amount * 12;
    } else {
      inactiveCount += 1;
    }

    planMap.set(
      subscription.planType,
      (planMap.get(subscription.planType) || 0) + subscription.amount
    );

    const firstPaymentMonthKey = format(startOfMonth(startDate), MONTH_FORMAT);
    customerMonthMap.set(
      firstPaymentMonthKey,
      (customerMonthMap.get(firstPaymentMonthKey) || 0) + 1
    );

    let installmentNumber = 1;
    let paymentDate = new Date(startDate);

    while (paymentDate <= referenceDate) {
      grossRevenue += subscription.amount;

      const monthDate = startOfMonth(paymentDate);
      const monthKey = format(monthDate, MONTH_FORMAT);
      const monthEntry =
        monthMap.get(monthKey) || { monthDate, newMRR: 0, existingMRR: 0 };

      if (installmentNumber === 1) {
        monthEntry.newMRR += subscription.amount;
      } else {
        monthEntry.existingMRR += subscription.amount;
      }

      monthMap.set(monthKey, monthEntry);

      const monthlyEntry =
        monthlyFinancialMap.get(monthKey) || { monthDate, gross: 0, fees: 0, payouts: 0 };
      monthlyEntry.gross += subscription.amount;
      monthlyEntry.payouts += subscription.amount;
      monthlyFinancialMap.set(monthKey, monthlyEntry);

      const dayKey = format(paymentDate, 'yyyy-MM-dd');
      const dailyEntry = dailyMap.get(dayKey) || { date: new Date(paymentDate), amount: 0, count: 0 };
      dailyEntry.amount += subscription.amount;
      dailyEntry.count += 1;
      dailyMap.set(dayKey, dailyEntry);

      subscriptionRecords.push({
        customerName: subscription.customerName,
        customerEmail: 'N/A',
        amount: subscription.amount,
        date: new Date(paymentDate),
        installmentNumber,
        invoiceId: `${subscription.id}-${format(paymentDate, 'yyyyMMdd')}`,
      });

      if (!isActive) {
        break;
      }

      paymentDate = addMonths(paymentDate, 1);
      installmentNumber += 1;
    }
  }

  const mrrData: MonthlyMRR[] = Array.from(monthMap.values())
    .map((value) => {
      const monthDate = value.monthDate;
      const totalMRR = value.newMRR + value.existingMRR;
      return {
        month: format(monthDate, 'MMM yyyy'),
        monthDate,
        newMRR: Math.round(value.newMRR * 100) / 100,
        existingMRR: Math.round(value.existingMRR * 100) / 100,
        totalMRR: Math.round(totalMRR * 100) / 100,
      };
    })
    .sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime());

  const sortedCustomerMonths = Array.from(customerMonthMap.entries())
    .map(([key, count]) => ({
      monthDate: startOfMonth(parseISO(`${key}-01`)),
      newCustomers: count,
    }))
    .sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime());

  let cumulative = 0;

  const customerTrends: CustomerTrend[] = sortedCustomerMonths.map((item) => {
    cumulative += item.newCustomers;
    return {
      month: format(item.monthDate, 'MMM yyyy'),
      monthDate: item.monthDate,
      newCustomers: item.newCustomers,
      cumulativeCustomers: cumulative,
    };
  });

  const revenueByPlan: PlanRevenue[] = Array.from(planMap.entries())
    .map(([plan, mrr]) => ({
      plan,
      mrr: Math.round(mrr * 100) / 100,
      percentage: 0,
    }));

  const totalMRR = revenueByPlan.reduce((sum, item) => sum + item.mrr, 0);

  const normalizedRevenueByPlan = revenueByPlan
    .map((item) => ({
      ...item,
      percentage: totalMRR > 0 ? Math.round((item.mrr / totalMRR) * 100 * 100) / 100 : 0,
    }))
    .sort((a, b) => b.mrr - a.mrr);

  const dailyPayouts: DailyPayout[] = Array.from(dailyMap.values())
    .map((entry) => ({
      date: format(entry.date, 'dd/MM/yyyy'),
      dateObj: entry.date,
      amount: Math.round(entry.amount * 100) / 100,
      count: entry.count,
      stripeAmount: 0,
      stripeCount: 0,
      pixAmount: Math.round(entry.amount * 100) / 100,
      pixCount: entry.count,
    }))
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  const monthlyFinancials: MonthlyFinancials[] = Array.from(monthlyFinancialMap.values())
    .map((entry) => ({
      month: format(entry.monthDate, 'MMM yyyy'),
      monthDate: entry.monthDate,
      grossRevenue: Math.round(entry.gross * 100) / 100,
      stripeFees: 0,
      netRevenue: Math.round(entry.gross * 100) / 100,
      payouts: Math.round(entry.payouts * 100) / 100,
    }))
    .sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime());

  const financialMetrics: FinancialMetrics = {
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    stripeFees: 0,
    netRevenue: Math.round(grossRevenue * 100) / 100,
    totalPayouts: Math.round(grossRevenue * 100) / 100,
    pendingBalance: 0,
    availableBalance: 0,
    feePercentage: 0,
  };

  const sortedSubscriptionRecords = subscriptionRecords
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((record) => ({
      ...record,
      amount: Math.round(record.amount * 100) / 100,
    }));

  return {
    mrrData,
    customerTrends,
    revenueByPlan: normalizedRevenueByPlan,
    churnSnapshot: {
      activeCount,
      inactiveCount,
    },
    arr: Math.round(arr * 100) / 100,
    totalSubscriptions: pixSubscriptions.length,
    dailyPayouts,
    monthlyFinancials,
    financialMetrics,
    subscriptionRecords: sortedSubscriptionRecords,
  };
}


