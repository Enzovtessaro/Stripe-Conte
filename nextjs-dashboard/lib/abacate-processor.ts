import { differenceInDays, format, parseISO, startOfMonth } from 'date-fns';
import type {
  CustomerTrend,
  DailyPayout,
  FinancialMetrics,
  MonthlyFinancials,
  MonthlyMRR,
  PlanRevenue,
  SubscriptionRecord,
} from './data-processor';
import type { AbacateCustomer, AbacatePixCharge } from './abacate';
import type { IdentityIndex } from './conte-identities';

const MONTH_FORMAT = 'yyyy-MM';
const DEFAULT_PLAN_LABEL = 'PIX Abacate Pay';

// Cobrança que não casa com nenhuma linha de pix_payments não passou pela
// create-pix-charge — é avulsa. Hoje são as renovações de certificado da
// cert-renovacao-reminder, todas de R$ 180, sem exceção nos dados verificados.
// Pagamento anual e único: entra na receita, mas não cria assinante.
const ONE_OFF_PLAN_LABEL = 'Certificado Digital (anual)';
const MONTHS_PER_YEAR = 12;

// A PIX subscriber pays monthly. Anyone whose last payment is older than this
// window is treated as churned, since Abacate has no subscription object here.
const ACTIVE_WINDOW_DAYS = 45;

// Valor de clients.status no backoffice do Conte para cliente ativo.
const ACTIVE_CLIENT_STATUS = 'ativa';

export interface OneOffMonth {
  month: string;
  monthDate: Date;
  revenue: number;
  count: number;
}

export interface AbacateMetrics {
  mrrData: MonthlyMRR[];
  customerTrends: CustomerTrend[];
  revenueByPlan: PlanRevenue[];
  churnSnapshot: { activeCount: number; inactiveCount: number };
  arr: number;
  totalSubscriptions: number;
  dailyPayouts: DailyPayout[];
  monthlyFinancials: MonthlyFinancials[];
  financialMetrics: FinancialMetrics;
  subscriptionRecords: SubscriptionRecord[];
  firstPaymentDate: Date | null;
  // Cobranças avulsas (hoje, renovação de certificado): entram na receita mas
  // não são assinatura de ninguém.
  oneOffMonthly: OneOffMonth[];
  oneOffTotal: number;
  oneOffLast12Months: number;
}

interface NormalizedPayment {
  chargeId: string;
  identified: boolean;
  customerKey: string;
  customerName: string;
  customerEmail: string;
  plan: string;
  amount: number;
  fee: number;
  paidAt: Date;
  // Status do cliente no backoffice, quando conhecido. Vale mais que inferir
  // atividade por tempo desde o último pagamento.
  clientStatus: string | null;
}

function readMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  keys: string[]
): string | null {
  if (!metadata) {
    return null;
  }

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }

  return null;
}

function normalizePayments(
  charges: AbacatePixCharge[],
  customers: AbacateCustomer[],
  identities: IdentityIndex
): NormalizedPayment[] {
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));

  return charges
    .filter((charge) => charge.status === 'PAID' && !charge.devMode)
    .map((charge) => {
      const linkedCustomer = charge.customer ?? (charge.customerId ? customerById.get(charge.customerId) : undefined);
      // Identidade vinda do backoffice do Conte, casada pelo id da cobrança ou
      // pelo externalId do metadata.
      const externalId = readMetadataString(charge.metadata, ['externalId']);
      const identity =
        identities.get(charge.id) || (externalId ? identities.get(externalId) : undefined);

      const identified = Boolean(
        identity?.companyName ||
          linkedCustomer?.name ||
          readMetadataString(charge.metadata, ['customerName', 'name'])
      );

      const customerName =
        identity?.companyName?.trim() ||
        linkedCustomer?.name?.trim() ||
        readMetadataString(charge.metadata, ['customerName', 'name']) ||
        charge.description?.trim() ||
        'Cliente PIX';

      const customerEmail =
        identity?.email?.trim() || linkedCustomer?.email?.trim() || 'N/A';

      const plan =
        identity?.plano?.trim() ||
        readMetadataString(charge.metadata, ['plan', 'planType', 'plano']) ||
        charge.description?.trim() ||
        DEFAULT_PLAN_LABEL;

      // `createdAt` is the payment date: a PIX QR is paid within its expiry window,
      // and these dates match the /trustMRR revenue endpoint day for day.
      // `updatedAt` is NOT usable — every charge in this account carries a recent
      // bulk-touched timestamp that would pile all revenue into the current month.
      const paidAt = parseISO(charge.createdAt);

      return {
        chargeId: charge.id,
        identified,
        // Without identity every charge is its own bucket, so unrelated payments
        // are never collapsed into one fictitious customer.
        customerKey: identified
          ? identity?.clientId ||
            linkedCustomer?.id ||
            (customerEmail !== 'N/A' ? customerEmail : customerName)
          : charge.id,
        customerName,
        customerEmail,
        plan,
        amount: charge.amount / 100,
        fee: (charge.platformFee ?? 0) / 100,
        paidAt,
        clientStatus: identity?.clientStatus ?? null,
      };
    })
    .filter((payment) => !Number.isNaN(payment.paidAt.getTime()))
    .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());
}

// Customers migrated from the manual PIX sheet already count as acquired there.
// Their Abacate revenue still counts; only the "new customer" flag is suppressed
// so the cumulative customer line does not count the same company twice.
export function normalizeCustomerName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\b(LTDA|ME|MEI|EIRELI|EPP|SA|S\/A)\b/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

// First day Abacate Pay actually settled money, used as the cutover point for
// the manual PIX records.
export function getFirstPaidDate(charges: AbacatePixCharge[]): Date | null {
  const paidDates = charges
    .filter((charge) => charge.status === 'PAID' && !charge.devMode)
    .map((charge) => parseISO(charge.createdAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  return paidDates.length > 0 ? paidDates[0] : null;
}

export function getAbacateMetrics(
  charges: AbacatePixCharge[],
  customers: AbacateCustomer[],
  referenceDate: Date = new Date(),
  alreadyCountedCustomerNames: string[] = [],
  identities: IdentityIndex = new Map()
): AbacateMetrics {
  const migratedCustomers = new Set(alreadyCountedCustomerNames.map(normalizeCustomerName));
  const payments = normalizePayments(charges, customers, identities);

  // /transparents/list returns no customer on a charge, so identity comes from the
  // Conte backoffice. Without it we can still report every cruzeiro, but any
  // per-customer metric would be invented, so those are left to the other sources.
  const hasIdentity = payments.some((payment) => payment.identified);

  const monthMap = new Map<string, { monthDate: Date; newMRR: number; existingMRR: number }>();
  const customerMonthMap = new Map<string, { monthDate: Date; count: number }>();
  const dailyMap = new Map<string, { date: Date; amount: number; count: number }>();
  const monthlyFinancialMap = new Map<
    string,
    { monthDate: Date; gross: number; fees: number }
  >();
  const paymentsPerCustomer = new Map<string, number>();
  const lastPaymentByCustomer = new Map<
    string,
    { paidAt: Date; amount: number; plan: string; clientStatus: string | null }
  >();
  const subscriptionRecords: SubscriptionRecord[] = [];

  let grossRevenue = 0;
  let totalFees = 0;

  const oneOffMap = new Map<string, { monthDate: Date; revenue: number; count: number }>();
  let oneOffTotal = 0;
  let oneOffLast12Months = 0;

  for (const payment of payments) {
    // Sem identidade = cobrança avulsa. Ela conta como receita em todo lugar,
    // mas não vira assinante: era isso que multiplicava cada certificado por 12
    // e inflava o ARR.
    const isOneOff = !payment.identified;

    const installmentNumber = (paymentsPerCustomer.get(payment.customerKey) || 0) + 1;
    paymentsPerCustomer.set(payment.customerKey, installmentNumber);

    if (isOneOff) {
      const monthDate = startOfMonth(payment.paidAt);
      const key = format(monthDate, MONTH_FORMAT);
      const entry = oneOffMap.get(key) || { monthDate, revenue: 0, count: 0 };
      entry.revenue += payment.amount;
      entry.count += 1;
      oneOffMap.set(key, entry);

      oneOffTotal += payment.amount;
      if (differenceInDays(referenceDate, payment.paidAt) <= 365) {
        oneOffLast12Months += payment.amount;
      }
    } else {
      lastPaymentByCustomer.set(payment.customerKey, {
        paidAt: payment.paidAt,
        amount: payment.amount,
        plan: payment.plan,
        clientStatus: payment.clientStatus,
      });
    }

    grossRevenue += payment.amount;
    totalFees += payment.fee;

    const monthDate = startOfMonth(payment.paidAt);
    const monthKey = format(monthDate, MONTH_FORMAT);

    const monthEntry = monthMap.get(monthKey) || { monthDate, newMRR: 0, existingMRR: 0 };
    if (installmentNumber === 1) {
      monthEntry.newMRR += payment.amount;
    } else {
      monthEntry.existingMRR += payment.amount;
    }
    monthMap.set(monthKey, monthEntry);

    if (
      hasIdentity &&
      !isOneOff &&
      installmentNumber === 1 &&
      !migratedCustomers.has(normalizeCustomerName(payment.customerName))
    ) {
      const trendEntry = customerMonthMap.get(monthKey) || { monthDate, count: 0 };
      trendEntry.count += 1;
      customerMonthMap.set(monthKey, trendEntry);
    }

    const monthlyEntry = monthlyFinancialMap.get(monthKey) || { monthDate, gross: 0, fees: 0 };
    monthlyEntry.gross += payment.amount;
    monthlyEntry.fees += payment.fee;
    monthlyFinancialMap.set(monthKey, monthlyEntry);

    const dayKey = format(payment.paidAt, 'yyyy-MM-dd');
    // Local midnight, matching the other processors, so every source lands on the
    // same Date key and merges into one bar per day.
    const dailyEntry = dailyMap.get(dayKey) || {
      date: new Date(`${dayKey}T00:00:00`),
      amount: 0,
      count: 0,
    };
    dailyEntry.amount += payment.amount;
    dailyEntry.count += 1;
    dailyMap.set(dayKey, dailyEntry);

    subscriptionRecords.push({
      customerName: payment.identified ? payment.customerName : ONE_OFF_PLAN_LABEL,
      customerEmail: payment.customerEmail,
      amount: Math.round(payment.amount * 100) / 100,
      date: payment.paidAt,
      installmentNumber: payment.identified ? installmentNumber : 1,
      invoiceId: payment.chargeId,
    });
  }

  const mrrData: MonthlyMRR[] = Array.from(monthMap.values())
    .map((entry) => {
      const total = entry.newMRR + entry.existingMRR;
      return {
        month: format(entry.monthDate, 'MMM yyyy'),
        monthDate: entry.monthDate,
        // Splitting new from existing needs to know who paid, so unattributed
        // revenue is reported whole as existing rather than guessed.
        newMRR: hasIdentity ? round(entry.newMRR) : 0,
        existingMRR: hasIdentity ? round(entry.existingMRR) : round(total),
        totalMRR: round(total),
      };
    })
    .sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime());

  let cumulative = 0;
  const customerTrends: CustomerTrend[] = Array.from(customerMonthMap.values())
    .sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime())
    .map((entry) => {
      cumulative += entry.count;
      return {
        month: format(entry.monthDate, 'MMM yyyy'),
        monthDate: entry.monthDate,
        newCustomers: entry.count,
        cumulativeCustomers: cumulative,
      };
    });

  // Current recurring value per plan = the latest amount each active customer paid.
  const planMap = new Map<string, number>();
  let activeCount = 0;
  let inactiveCount = 0;
  let activeMRR = 0;

  for (const last of Array.from(lastPaymentByCustomer.values())) {
    // O status do backoffice é a verdade sobre quem é cliente. A janela de dias
    // só entra quando ele não veio, e é palpite: PIX não tem objeto de assinatura.
    const isActive = last.clientStatus !== null
      ? last.clientStatus === ACTIVE_CLIENT_STATUS
      : differenceInDays(referenceDate, last.paidAt) <= ACTIVE_WINDOW_DAYS;

    if (isActive) {
      activeCount += 1;
      activeMRR += last.amount;
      planMap.set(last.plan, (planMap.get(last.plan) || 0) + last.amount);
    } else {
      inactiveCount += 1;
    }
  }

  // Um pagamento anual comparado a planos mensais vale o duodécimo: é assim que
  // um plano anual entra num mix de MRR sem distorcer as fatias.
  if (oneOffLast12Months > 0) {
    planMap.set(ONE_OFF_PLAN_LABEL, oneOffLast12Months / MONTHS_PER_YEAR);
  }

  const planTotal = Array.from(planMap.values()).reduce((sum, value) => sum + value, 0);
  const revenueByPlan: PlanRevenue[] = Array.from(planMap.entries())
    .map(([plan, mrr]) => ({
      plan,
      mrr: round(mrr),
      percentage: planTotal > 0 ? Math.round((mrr / planTotal) * 100 * 100) / 100 : 0,
    }))
    .sort((a, b) => b.mrr - a.mrr);

  const dailyPayouts: DailyPayout[] = Array.from(dailyMap.values())
    .map((entry) => ({
      date: format(entry.date, 'dd/MM/yyyy'),
      dateObj: entry.date,
      amount: round(entry.amount),
      count: entry.count,
      stripeAmount: 0,
      stripeCount: 0,
      pixAmount: round(entry.amount),
      pixCount: entry.count,
    }))
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  const monthlyFinancials: MonthlyFinancials[] = Array.from(monthlyFinancialMap.values())
    .map((entry) => ({
      month: format(entry.monthDate, 'MMM yyyy'),
      monthDate: entry.monthDate,
      grossRevenue: round(entry.gross),
      stripeFees: round(entry.fees),
      netRevenue: round(entry.gross - entry.fees),
      payouts: round(entry.gross - entry.fees),
    }))
    .sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime());

  const financialMetrics: FinancialMetrics = {
    grossRevenue: round(grossRevenue),
    stripeFees: round(totalFees),
    netRevenue: round(grossRevenue - totalFees),
    totalPayouts: round(grossRevenue - totalFees),
    pendingBalance: 0,
    availableBalance: 0,
    feePercentage: grossRevenue > 0 ? Math.round((totalFees / grossRevenue) * 100 * 100) / 100 : 0,
  };

  return {
    mrrData,
    customerTrends: hasIdentity ? customerTrends : [],
    revenueByPlan: hasIdentity ? revenueByPlan : [],
    churnSnapshot: hasIdentity ? { activeCount, inactiveCount } : { activeCount: 0, inactiveCount: 0 },
    // O avulso ja e anual: entra pelo valor cheio dos ultimos 12 meses, nao x12.
    arr: hasIdentity ? round(activeMRR * MONTHS_PER_YEAR + oneOffLast12Months) : round(oneOffLast12Months),
    totalSubscriptions: hasIdentity ? lastPaymentByCustomer.size : 0,
    dailyPayouts,
    monthlyFinancials,
    financialMetrics,
    subscriptionRecords: subscriptionRecords.sort((a, b) => b.date.getTime() - a.date.getTime()),
    firstPaymentDate: payments.length > 0 ? payments[0].paidAt : null,
    oneOffMonthly: Array.from(oneOffMap.values())
      .map((entry) => ({
        month: format(entry.monthDate, 'MMM yyyy'),
        monthDate: entry.monthDate,
        revenue: round(entry.revenue),
        count: entry.count,
      }))
      .sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime()),
    oneOffTotal: round(oneOffTotal),
    oneOffLast12Months: round(oneOffLast12Months),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
