const ABACATE_API_BASE = 'https://api.abacatepay.com/v2';

export interface AbacateCustomer {
  id: string;
  name?: string | null;
  email?: string | null;
  taxId?: string | null;
  cellphone?: string | null;
}

export interface AbacatePixCharge {
  id: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED';
  devMode?: boolean;
  platformFee?: number;
  description?: string | null;
  receiptUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
  customerId?: string | null;
  customer?: (AbacateCustomer & { metadata?: Record<string, unknown> | null }) | null;
}

interface AbacateEnvelope<T> {
  data: T | null;
  success: boolean;
  error: string | null;
}

export function isAbacateConfigured(): boolean {
  return Boolean(process.env.ABACATE_PAY_API_KEY);
}

async function abacateGet<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const apiKey = process.env.ABACATE_PAY_API_KEY;

  if (!apiKey) {
    throw new Error('ABACATE_PAY_API_KEY is not set');
  }

  const url = new URL(`${ABACATE_API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Abacate Pay ${path} responded ${response.status}`);
  }

  const payload = (await response.json()) as AbacateEnvelope<T>;

  // The API always returns HTTP 200 with success:false on business errors.
  if (!payload.success) {
    throw new Error(`Abacate Pay ${path} failed: ${payload.error ?? 'unknown error'}`);
  }

  return (payload.data ?? ([] as unknown)) as T;
}

// The v2 list endpoints page by cursor and do not return a `pagination` object,
// so we keep requesting until a page comes back shorter than the limit.
async function paginate<T extends { id: string }>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  maxPages = 50
): Promise<T[]> {
  const limit = 100;
  const results: T[] = [];
  let after: string | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const batch = await abacateGet<T[]>(path, { ...params, limit, after });

    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }

    results.push(...batch);

    if (batch.length < limit) {
      break;
    }

    after = batch[batch.length - 1].id;
  }

  return results;
}

export async function getAbacatePixCharges(startDate?: Date): Promise<AbacatePixCharge[]> {
  const params: Record<string, string | undefined> = {};

  if (startDate) {
    params.startDate = startDate.toISOString().slice(0, 10);
  }

  const charges = await paginate<AbacatePixCharge>('/transparents/list', params);

  return charges.filter((charge) => !charge.devMode);
}

export async function getAbacateCustomers(): Promise<AbacateCustomer[]> {
  return paginate<AbacateCustomer>('/customers/list');
}

export interface AbacateData {
  charges: AbacatePixCharge[];
  customers: AbacateCustomer[];
}

// Never let an Abacate outage take the whole dashboard down: Stripe data still renders.
export async function getAbacateData(startDate?: Date): Promise<AbacateData> {
  if (!isAbacateConfigured()) {
    return { charges: [], customers: [] };
  }

  try {
    const [charges, customers] = await Promise.all([
      getAbacatePixCharges(startDate),
      getAbacateCustomers().catch(() => [] as AbacateCustomer[]),
    ]);

    return { charges, customers };
  } catch (error) {
    console.error('Error fetching Abacate Pay data:', error);
    return { charges: [], customers: [] };
  }
}
