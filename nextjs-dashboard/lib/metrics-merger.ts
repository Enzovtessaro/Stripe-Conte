import {
  MonthlyMRR,
  CustomerTrend,
  PlanRevenue,
  ChurnMetrics,
  MonthlyFinancials,
  DailyPayout,
  SubscriptionRecord,
  FinancialMetrics,
} from './data-processor';
import { startOfMonth, format } from 'date-fns';

// Merge Stripe and PIX MRR data by month
export function mergeMRRData(
  stripeMRR: MonthlyMRR[],
  pixMRR: Array<{ month: string; monthDate: Date; newMRR: number; existingMRR: number; totalMRR: number }>
): MonthlyMRR[] {
  // Use yyyy-MM format as key (same as Stripe uses internally)
  const monthMap = new Map<string, MonthlyMRR>();
  
  // Add Stripe data
  for (const item of stripeMRR) {
    // Normalize to first day of month and use yyyy-MM as key
    const normalizedDate = startOfMonth(item.monthDate);
    const key = format(normalizedDate, 'yyyy-MM');
    
    monthMap.set(key, {
      month: item.month,
      monthDate: normalizedDate,
      newMRR: item.newMRR,
      existingMRR: item.existingMRR,
      totalMRR: item.totalMRR,
    });
  }
  
  // Add PIX data
  for (const item of pixMRR) {
    // Normalize to first day of month and use yyyy-MM as key
    const normalizedDate = startOfMonth(item.monthDate);
    const key = format(normalizedDate, 'yyyy-MM');
    
    const existing = monthMap.get(key);
    
    if (existing) {
      existing.newMRR += item.newMRR;
      existing.existingMRR += item.existingMRR;
      existing.totalMRR += item.totalMRR;
    } else {
      monthMap.set(key, {
        month: item.month,
        monthDate: normalizedDate,
        newMRR: item.newMRR,
        existingMRR: item.existingMRR,
        totalMRR: item.totalMRR,
      });
    }
  }
  
  // Convert to array and sort by date
  return Array.from(monthMap.values())
    .sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime())
    .map(item => ({
      ...item,
      newMRR: Math.round(item.newMRR * 100) / 100,
      existingMRR: Math.round(item.existingMRR * 100) / 100,
      totalMRR: Math.round(item.totalMRR * 100) / 100,
    }));
}

// Merge customer trends
export function mergeCustomerTrends(
  stripeTrends: CustomerTrend[],
  pixTrends: Array<{ month: string; monthDate: Date; newCustomers: number; cumulativeCustomers: number }>
): CustomerTrend[] {
  // Use yyyy-MM format as key (same as Stripe uses internally)
  const monthMap = new Map<string, { newCustomers: number; monthDate: Date }>();
  
  // Collect Stripe new customers by month
  for (const item of stripeTrends) {
    // Normalize to first day of month and use yyyy-MM as key
    const normalizedDate = startOfMonth(item.monthDate);
    const key = format(normalizedDate, 'yyyy-MM');
    
    monthMap.set(key, {
      newCustomers: item.newCustomers,
      monthDate: normalizedDate,
    });
  }
  
  // Add PIX new customers to the SAME months
  for (const item of pixTrends) {
    // Normalize to first day of month and use yyyy-MM as key
    const normalizedDate = startOfMonth(item.monthDate);
    const key = format(normalizedDate, 'yyyy-MM');
    
    const existing = monthMap.get(key);
    
    if (existing) {
      // Same month - add PIX customers to Stripe customers
      existing.newCustomers += item.newCustomers;
    } else {
      // New month (only has PIX)
      monthMap.set(key, {
        newCustomers: item.newCustomers,
        monthDate: normalizedDate,
      });
    }
  }
  
  // Convert to array and sort by date
  const sorted = Array.from(monthMap.values())
    .sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime());
  
  // Calculate cumulative customers
  let cumulative = 0;
  const result: CustomerTrend[] = [];
  
  for (const item of sorted) {
    cumulative += item.newCustomers;
    result.push({
      month: format(item.monthDate, 'MMM yyyy'),
      monthDate: item.monthDate,
      newCustomers: item.newCustomers,
      cumulativeCustomers: cumulative,
    });
  }
  
  return result;
}

// Merge revenue by plan
export function mergeRevenueByPlan(
  stripeRevenue: PlanRevenue[],
  pixRevenue: Array<{ plan: string; mrr: number; percentage: number }>
): PlanRevenue[] {
  const planMap = new Map<string, number>();
  
  // Add Stripe data
  for (const item of stripeRevenue) {
    planMap.set(item.plan, item.mrr);
  }
  
  // Add PIX data
  for (const item of pixRevenue) {
    const existing = planMap.get(item.plan) || 0;
    planMap.set(item.plan, existing + item.mrr);
  }
  
  // Calculate total and percentages
  const totalMRR = Array.from(planMap.values()).reduce((sum, mrr) => sum + mrr, 0);
  
  return Array.from(planMap.entries())
    .map(([plan, mrr]) => ({
      plan,
      mrr: Math.round(mrr * 100) / 100,
      percentage: totalMRR > 0 ? Math.round((mrr / totalMRR) * 100 * 100) / 100 : 0,
    }))
    .sort((a, b) => b.mrr - a.mrr);
}

// Merge churn metrics
export function mergeChurnMetrics(
  stripeChurn: ChurnMetrics,
  pixChurn: { activeCount: number; inactiveCount: number }
): ChurnMetrics {
  const totalActive = stripeChurn.activeCount + pixChurn.activeCount;
  const totalPreviousActive = stripeChurn.previousActiveCount + pixChurn.activeCount + pixChurn.inactiveCount;
  const totalChurned = stripeChurn.churnedCount + pixChurn.inactiveCount;
  
  const churnRate = totalPreviousActive > 0 
    ? (totalChurned / totalPreviousActive) * 100 
    : 0;
  
  return {
    churnRate: Math.round(churnRate * 10) / 10,
    churnedCount: totalChurned,
    activeCount: totalActive,
    previousActiveCount: totalPreviousActive,
  };
}

export function mergeFinancialMetrics(
  stripeMetrics: FinancialMetrics,
  pixMetrics: FinancialMetrics
): FinancialMetrics {
  const grossRevenue = stripeMetrics.grossRevenue + pixMetrics.grossRevenue;
  const stripeFees = stripeMetrics.stripeFees + pixMetrics.stripeFees;
  const netRevenue = grossRevenue - stripeFees;
  const totalPayouts = stripeMetrics.totalPayouts + pixMetrics.totalPayouts;

  const feePercentage = grossRevenue > 0 ? Math.round(((stripeFees / grossRevenue) * 100) * 100) / 100 : 0;

  return {
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    stripeFees: Math.round(stripeFees * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    totalPayouts: Math.round(totalPayouts * 100) / 100,
    pendingBalance: stripeMetrics.pendingBalance,
    availableBalance: stripeMetrics.availableBalance,
    feePercentage,
  };
}

export function mergeMonthlyFinancials(
  stripeMonthly: MonthlyFinancials[],
  pixMonthly: MonthlyFinancials[]
): MonthlyFinancials[] {
  const monthMap = new Map<string, MonthlyFinancials>();

  for (const item of stripeMonthly) {
    const key = format(startOfMonth(item.monthDate), 'yyyy-MM');
    monthMap.set(key, { ...item });
  }

  for (const pix of pixMonthly) {
    const key = format(startOfMonth(pix.monthDate), 'yyyy-MM');
    const existing = monthMap.get(key);

    if (existing) {
      existing.grossRevenue = Math.round((existing.grossRevenue + pix.grossRevenue) * 100) / 100;
      existing.stripeFees = Math.round((existing.stripeFees + pix.stripeFees) * 100) / 100;
      existing.netRevenue = Math.round((existing.netRevenue + pix.netRevenue) * 100) / 100;
      existing.payouts = Math.round((existing.payouts + pix.payouts) * 100) / 100;
    } else {
      monthMap.set(key, { ...pix });
    }
  }

  return Array.from(monthMap.values()).sort(
    (a, b) => a.monthDate.getTime() - b.monthDate.getTime()
  );
}

export function mergeDailyPayouts(
  stripeDaily: DailyPayout[],
  pixDaily: DailyPayout[]
): DailyPayout[] {
  const dayMap = new Map<string, DailyPayout>();

  const accumulate = (entry: DailyPayout, source: 'stripe' | 'pix') => {
    const key = entry.dateObj.toISOString();
    const existing =
      dayMap.get(key) || {
        date: entry.date,
        dateObj: entry.dateObj,
        amount: 0,
        count: 0,
        stripeAmount: 0,
        stripeCount: 0,
        pixAmount: 0,
        pixCount: 0,
      };

    existing.amount = Math.round((existing.amount + entry.amount) * 100) / 100;
    existing.count += entry.count;

    if (source === 'stripe') {
      existing.stripeAmount = Math.round(
        (existing.stripeAmount + (entry.stripeAmount ?? entry.amount)) * 100
      ) / 100;
      existing.stripeCount += entry.stripeCount ?? entry.count;
    } else {
      existing.pixAmount = Math.round(
        (existing.pixAmount + (entry.pixAmount ?? entry.amount)) * 100
      ) / 100;
      existing.pixCount += entry.pixCount ?? entry.count;
    }

    dayMap.set(key, existing);
  };

  for (const item of stripeDaily) {
    accumulate(item, 'stripe');
  }

  for (const item of pixDaily) {
    accumulate(item, 'pix');
  }

  return Array.from(dayMap.values())
    .map((entry) => {
      const stripeAmount = entry.stripeAmount ?? 0;
      const pixAmount = entry.pixAmount ?? 0;
      const stripeCount = entry.stripeCount ?? 0;
      const pixCount = entry.pixCount ?? 0;

      return {
        ...entry,
        amount: Math.round((stripeAmount + pixAmount) * 100) / 100,
        count: stripeCount + pixCount,
        stripeAmount,
        pixAmount,
        stripeCount,
        pixCount,
      };
    })
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
}

export function mergeSubscriptionRecords(
  stripeRecords: SubscriptionRecord[],
  pixRecords: SubscriptionRecord[]
): SubscriptionRecord[] {
  return [...stripeRecords, ...pixRecords].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );
}

