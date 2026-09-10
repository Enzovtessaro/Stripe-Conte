// O Abacate não devolve `customer` nem `description` ao listar cobranças, então
// a identidade de cada pagamento vem do backoffice do Conte, pela edge function
// `pix-charge-identities`. A ponte é o id da cobrança (`pix_char_...`), que o
// backoffice guarda em pix_payments.abacate_pix_id.
export interface ChargeIdentity {
  abacatePixId: string | null;
  externalId: string | null;
  clientId: string | null;
  companyName: string | null;
  email: string | null;
  plano: string | null;
  clientStatus: string | null;
  amount: number | null;
  month: number | null;
  year: number | null;
  paymentStatus: string | null;
}

interface IdentitiesResponse {
  identities: ChargeIdentity[];
  count: number;
  nextOffset: number | null;
}

export type IdentityIndex = Map<string, ChargeIdentity>;

export function isConteIdentitiesConfigured(): boolean {
  return Boolean(process.env.CONTE_FUNCTIONS_URL && process.env.CONTE_DASHBOARD_TOKEN);
}

// Indexa por id da cobrança e também por externalId, para casar tanto pelo id
// que vem na listagem quanto pelo metadata.externalId.
export async function getChargeIdentities(): Promise<IdentityIndex> {
  const index: IdentityIndex = new Map();

  if (!isConteIdentitiesConfigured()) {
    return index;
  }

  const base = process.env.CONTE_FUNCTIONS_URL!.replace(/\/$/, '');
  const token = process.env.CONTE_DASHBOARD_TOKEN!;

  try {
    let offset = 0;

    for (let page = 0; page < 50; page += 1) {
      const url = new URL(`${base}/pix-charge-identities`);
      url.searchParams.set('limit', '1000');
      url.searchParams.set('offset', String(offset));

      const response = await fetch(url.toString(), {
        headers: { 'x-dashboard-token': token, Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`pix-charge-identities responded ${response.status}`);
      }

      const payload = (await response.json()) as IdentitiesResponse;

      for (const identity of payload.identities ?? []) {
        if (identity.abacatePixId) index.set(identity.abacatePixId, identity);
        if (identity.externalId) index.set(identity.externalId, identity);
      }

      if (payload.nextOffset === null || payload.nextOffset === undefined) {
        break;
      }

      offset = payload.nextOffset;
    }
  } catch (error) {
    // Sem identidade o dashboard ainda mostra o dinheiro certo; as métricas por
    // cliente é que ficam de fora, em vez de sairem erradas.
    console.error('Error fetching charge identities from Conte:', error);
    return new Map();
  }

  return index;
}
