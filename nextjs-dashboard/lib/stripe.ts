import Stripe from 'stripe';

// Lazy initialization - create Stripe client only when needed
function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });
}

export async function getSubscriptions() {
  const stripe = getStripeClient();
  const subscriptions: Stripe.Subscription[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const result = await stripe.subscriptions.list({
      limit: 100,
      starting_after: startingAfter,
      expand: ['data.default_payment_method'],
    });

    subscriptions.push(...result.data);
    hasMore = result.has_more;
    
    if (hasMore && result.data.length > 0) {
      startingAfter = result.data[result.data.length - 1].id;
    }
  }

  return subscriptions;
}

export async function getProducts(productIds: string[]) {
  const stripe = getStripeClient();
  const products: Record<string, string> = {};
  
  for (const productId of productIds) {
    try {
      const product = await stripe.products.retrieve(productId);
      products[productId] = product.name;
    } catch (error) {
      console.error(`Error fetching product ${productId}:`, error);
      products[productId] = productId;
    }
  }
  
  return products;
}

export async function getBalanceTransactions(startDate?: Date) {
  const stripe = getStripeClient();
  const transactions: Stripe.BalanceTransaction[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  const params: Stripe.BalanceTransactionListParams = {
    limit: 100,
    ...(startDate && { created: { gte: Math.floor(startDate.getTime() / 1000) } }),
  };

  while (hasMore) {
    const result = await stripe.balanceTransactions.list({
      ...params,
      starting_after: startingAfter,
    });

    transactions.push(...result.data);
    hasMore = result.has_more;

    if (hasMore && result.data.length > 0) {
      startingAfter = result.data[result.data.length - 1].id;
    }
  }

  return transactions;
}

export async function getPayouts(startDate?: Date) {
  const stripe = getStripeClient();
  const payouts: Stripe.Payout[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  const params: Stripe.PayoutListParams = {
    limit: 100,
    ...(startDate && { created: { gte: Math.floor(startDate.getTime() / 1000) } }),
  };

  while (hasMore) {
    const result = await stripe.payouts.list({
      ...params,
      starting_after: startingAfter,
    });

    payouts.push(...result.data);
    hasMore = result.has_more;

    if (hasMore && result.data.length > 0) {
      startingAfter = result.data[result.data.length - 1].id;
    }
  }

  return payouts;
}

export async function getCurrentBalance() {
  const stripe = getStripeClient();
  return await stripe.balance.retrieve();
}

// Faturas pagas do CICLO daquele mes: as que tem period_start dentro do mes.
//
// Nao serve olhar a data de criacao: assinatura do Stripe cobra em ciclo
// proprio, uma fatura emitida em 20/08 pode ser o ciclo 20/08-20/09. Nem serve
// olhar sobreposicao de periodo, que e o oposto — qualquer fatura de agosto
// encosta em setembro e daria o mes por pago. O que identifica o pagamento
// DAQUELE mes e o inicio do periodo cobrado.
export async function getPaidInvoicesForCycleMonth(month: number, year: number) {
  const stripe = getStripeClient();
  const monthStart = Math.floor(Date.UTC(year, month - 1, 1) / 1000);
  const monthEnd = Math.floor(Date.UTC(year, month, 1) / 1000);
  // A fatura pode ser emitida alguns dias antes ou depois do inicio do ciclo.
  const createdGte = monthStart - 10 * 24 * 60 * 60;
  const createdLt = monthEnd + 10 * 24 * 60 * 60;

  const invoices: Stripe.Invoice[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const result = await stripe.invoices.list({
      limit: 100,
      status: 'paid',
      created: { gte: createdGte, lt: createdLt },
      starting_after: startingAfter,
    });

    invoices.push(...result.data);
    hasMore = result.has_more;

    if (hasMore && result.data.length > 0) {
      startingAfter = result.data[result.data.length - 1].id;
    }
  }

  return invoices.filter((invoice) => {
    const line = invoice.lines?.data?.[0]?.period;
    const start = line?.start ?? invoice.period_start ?? invoice.created;
    return start >= monthStart && start < monthEnd;
  });
}

// Assinaturas em vigor, indexadas por cliente e por email. O email importa
// porque uma assinatura pode cobrir mais de uma empresa do cadastro, e nesses
// casos o stripe_customer_id do cadastro as vezes aponta para um cliente antigo.
export interface SubscriptionCoverage {
  status: string;
  currentPeriodEnd: number;
  amount: number;
  email: string | null;
}

export async function getSubscriptionCoverage() {
  const stripe = getStripeClient();
  const subscriptions: Stripe.Subscription[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const result = await stripe.subscriptions.list({
      limit: 100,
      starting_after: startingAfter,
      expand: ['data.customer'],
    });
    subscriptions.push(...result.data);
    hasMore = result.has_more;
    if (hasMore && result.data.length > 0) {
      startingAfter = result.data[result.data.length - 1].id;
    }
  }

  const byCustomer = new Map<string, SubscriptionCoverage>();
  const byEmail = new Map<string, SubscriptionCoverage>();

  for (const sub of subscriptions) {
    const customer = sub.customer;
    const customerId = typeof customer === 'string' ? customer : customer?.id;
    const email =
      typeof customer === 'string'
        ? null
        : ((customer as Stripe.Customer)?.email ?? null);

    const amount = sub.items.data.reduce(
      (sum, item) => sum + ((item.price.unit_amount ?? 0) * (item.quantity ?? 1)) / 100,
      0
    );

    const entry: SubscriptionCoverage = {
      status: sub.status,
      currentPeriodEnd: sub.current_period_end,
      amount,
      email: email?.trim().toLowerCase() ?? null,
    };

    // Entre varias, vale a que cobre mais para frente.
    if (customerId) {
      const existing = byCustomer.get(customerId);
      if (!existing || entry.currentPeriodEnd > existing.currentPeriodEnd) {
        byCustomer.set(customerId, entry);
      }
    }
    if (entry.email) {
      const existing = byEmail.get(entry.email);
      if (!existing || entry.currentPeriodEnd > existing.currentPeriodEnd) {
        byEmail.set(entry.email, entry);
      }
    }
  }

  return { byCustomer, byEmail };
}

export async function getInvoices(startDate?: Date) {
  const stripe = getStripeClient();
  const invoices: Stripe.Invoice[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  const params: Stripe.InvoiceListParams = {
    limit: 100,
    expand: ['data.customer'],
    ...(startDate && { created: { gte: Math.floor(startDate.getTime() / 1000) } }),
  };

  while (hasMore) {
    const result = await stripe.invoices.list({
      ...params,
      starting_after: startingAfter,
    });

    invoices.push(...result.data);
    hasMore = result.has_more;

    if (hasMore && result.data.length > 0) {
      startingAfter = result.data[result.data.length - 1].id;
    }
  }

  return invoices;
}

