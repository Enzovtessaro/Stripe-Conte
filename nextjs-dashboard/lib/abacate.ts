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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A v2 responde 400 genérico (sem mensagem) quando está sob throttle, não só em
// requisição malformada — visto em produção com a mesma URL que funcionava
// segundos antes. Como não dá para distinguir pelo status, vale retentar.
const RETRY_STATUSES = new Set([400, 408, 429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [1000, 3000, 6000];

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

  let response: Response | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    response = await fetch(url.toString(), {
      headers: {
        // Sem o Accept a v2 responde 400 — não é opcional.
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (response.ok || !RETRY_STATUSES.has(response.status)) break;
    if (attempt === RETRY_DELAYS_MS.length) break;

    await sleep(RETRY_DELAYS_MS[attempt]);
  }

  if (!response || !response.ok) {
    throw new Error(`Abacate Pay ${path} responded ${response?.status ?? 'no response'}`);
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
  // Filtrar no servidor corta 205 cobrancas (3 paginas) para 66 (1 pagina). A
  // v2 throttla com facilidade, entao cada requisicao a menos conta.
  const params: Record<string, string | undefined> = { status: 'PAID' };

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
  // false quando a busca falhou: o PIX da Abacate está faltando no resultado.
  // Quem consome precisa avisar, e não somar como se o total estivesse completo.
  available: boolean;
}

// Cada carregamento do dashboard puxava todo o histórico, e a página chama a
// rota duas vezes — era pressão suficiente para a própria Abacate throttlar e
// devolver 400. Um cache curto derruba isso sem deixar o número velho.
const CACHE_TTL_MS = 60_000;
let cache: { at: number; data: AbacateData } | null = null;

export async function getAbacateData(startDate?: Date): Promise<AbacateData> {
  if (!isAbacateConfigured()) {
    return { charges: [], customers: [], available: true };
  }

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }

  try {
    // Sem getAbacateCustomers: nenhuma cobranca referencia cliente, entao a
    // lista nao resolvia nada e so gastava requisicao contra o throttle.
    const charges = await getAbacatePixCharges(startDate);

    const data: AbacateData = { charges, customers: [], available: true };
    cache = { at: Date.now(), data };
    return data;
  } catch (error) {
    console.error('Error fetching Abacate Pay data:', error);
    // Um resultado bom recente vale mais que sumir com a receita do PIX.
    if (cache) return cache.data;
    return { charges: [], customers: [], available: false };
  }
}
