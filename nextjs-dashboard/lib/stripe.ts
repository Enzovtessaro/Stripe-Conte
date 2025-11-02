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

