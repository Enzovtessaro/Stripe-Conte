import { NextResponse } from 'next/server';
import { getPaidInvoicesForCycleMonth, getSubscriptionCoverageByCustomer } from '@/lib/stripe';

interface ReconciliationRow {
  clientId: string;
  companyName: string | null;
  email: string;
  amount: number;
  method: 'pix' | 'cartao';
  dueDay: number | null;
  status: 'pago' | 'aguardando' | 'nao_pago' | 'sem_cobranca';
  paidAt: string | null;
  hasCharge: boolean;
  stripeCustomerId: string | null;
}

// Proxy da conciliação do backoffice do Conte. Existe para o token não sair do
// servidor e para o dashboard não precisar conhecer a URL do Supabase.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const base = process.env.CONTE_FUNCTIONS_URL;
  const token = process.env.CONTE_DASHBOARD_TOKEN;

  if (!base || !token) {
    return NextResponse.json(
      { error: 'Conciliação indisponível: CONTE_FUNCTIONS_URL e CONTE_DASHBOARD_TOKEN não configurados.' },
      { status: 503 }
    );
  }

  const requested = new URL(request.url);
  const target = new URL(`${base.replace(/\/$/, '')}/monthly-reconciliation`);
  for (const key of ['month', 'year']) {
    const value = requested.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }

  try {
    const response = await fetch(target.toString(), {
      headers: { 'x-dashboard-token': token, Accept: 'application/json' },
      cache: 'no-store',
    });

    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error ?? `Conciliação respondeu ${response.status}` },
        { status: response.status }
      );
    }

    const month = Number(target.searchParams.get('month'));
    const year = Number(target.searchParams.get('year'));
    const enriched = await reconcileWithStripe(payload, month, year);

    return NextResponse.json(enriched, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Error fetching reconciliation:', error);
    return NextResponse.json({ error: 'Falha ao consultar a conciliação.' }, { status: 502 });
  }
}

// O backoffice so conhece o pagamento pela linha em pix_payments, criada pelo
// webhook do Stripe. Quando esse webhook falha, a fatura e paga mas a linha nao
// existe — e o cliente aparecia como "sem cobranca gerada" tendo pago. Em
// agosto/2026 isso acontecia com 4 de 19. O Stripe e a autoridade sobre cartao,
// entao ele decide.
async function reconcileWithStripe(
  payload: { rows?: ReconciliationRow[]; month?: number; year?: number },
  month: number,
  year: number
) {
  const rows = payload.rows ?? [];

  if (rows.length === 0 || !month || !year) {
    return payload;
  }

  let invoices: Awaited<ReturnType<typeof getPaidInvoicesForCycleMonth>>;
  let coverage: Awaited<ReturnType<typeof getSubscriptionCoverageByCustomer>>;
  try {
    [invoices, coverage] = await Promise.all([
      getPaidInvoicesForCycleMonth(month, year),
      getSubscriptionCoverageByCustomer(),
    ]);
  } catch (error) {
    // Sem o Stripe a conciliacao ainda vale pelo backoffice; so nao corrige.
    console.error('Reconciliation: could not read Stripe invoices:', error);
    return { ...payload, stripeChecked: false };
  }

  const paidByCustomerId = new Map<string, { paidAt: string; amount: number }>();
  const paidByEmail = new Map<string, { paidAt: string; amount: number }>();
  const emailSeen = new Map<string, number>();

  for (const invoice of invoices) {
    const paidAt = new Date(
      (invoice.status_transitions?.paid_at ?? invoice.created) * 1000
    ).toISOString();
    const entry = { paidAt, amount: (invoice.amount_paid ?? 0) / 100 };

    const customerId =
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (customerId) {
      const existing = paidByCustomerId.get(customerId);
      if (!existing || paidAt > existing.paidAt) paidByCustomerId.set(customerId, entry);
    }

    const email = invoice.customer_email?.trim().toLowerCase();
    if (email) {
      const existing = paidByEmail.get(email);
      if (!existing || paidAt > existing.paidAt) paidByEmail.set(email, entry);
    }
  }

  // 11 clientes do backoffice compartilham email com outro cliente. Casar por
  // email nesses casos marcaria um como pago pelo pagamento do outro, entao o
  // email so vale quando aponta para um cliente so.
  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    if (email) emailSeen.set(email, (emailSeen.get(email) ?? 0) + 1);
  }

  const now = Math.floor(Date.now() / 1000);
  const monthStart = Math.floor(Date.UTC(year, month - 1, 1) / 1000);
  const monthEnd = Math.floor(Date.UTC(year, month, 1) / 1000);
  const isCurrentMonth = now >= monthStart && now < monthEnd;

  const reconciled = rows.map((row) => {
    if (row.status === 'pago') return row;

    const email = row.email?.trim().toLowerCase() ?? '';
    // O id do Stripe e inequivoco; o email so entra quando nao ha id e o
    // endereco pertence a um unico cliente.
    const match = (row.stripeCustomerId && paidByCustomerId.get(row.stripeCustomerId)) ||
      (!row.stripeCustomerId && emailSeen.get(email) === 1 ? paidByEmail.get(email) : undefined);

    if (match) {
      return {
        ...row,
        status: 'pago' as const,
        method: 'cartao' as const,
        paidAt: match.paidAt,
        amount: row.amount || match.amount,
        // Pago no Stripe sem a linha do backoffice: o dinheiro entrou, o
        // registro interno e que ficou faltando.
        missingBackofficeRecord: true,
      };
    }

    // Assinatura ativa cujo ciclo ainda nao virou dentro deste mes: a cobranca
    // esta por vir, nao esta em atraso. Duas empresas podem dividir uma
    // assinatura so (Selbach, Nakamoto) e o ciclo dela cai no dia 23 e no 20 —
    // sem isso as duas apareciam como "sem cobranca" no inicio do mes.
    const sub = row.stripeCustomerId ? coverage.get(row.stripeCustomerId) : undefined;
    const subAtiva = sub && (sub.status === 'active' || sub.status === 'trialing');

    if (isCurrentMonth && subAtiva && sub.currentPeriodEnd > now) {
      return {
        ...row,
        status: 'aguardando' as const,
        method: 'cartao' as const,
        nextChargeAt: new Date(sub.currentPeriodEnd * 1000).toISOString(),
      };
    }

    return row;
  });

  const summary = {
    total: reconciled.length,
    pago: reconciled.filter((r) => r.status === 'pago').length,
    aguardando: reconciled.filter((r) => r.status === 'aguardando').length,
    naoPago: reconciled.filter((r) => r.status === 'nao_pago').length,
    semCobranca: reconciled.filter((r) => r.status === 'sem_cobranca').length,
    valorPago: reconciled
      .filter((r) => r.status === 'pago')
      .reduce((sum, r) => sum + (r.amount ?? 0), 0),
    valorEsperado: reconciled.reduce((sum, r) => sum + (r.amount ?? 0), 0),
    corrigidosPeloStripe: reconciled.filter(
      (r) => (r as { missingBackofficeRecord?: boolean }).missingBackofficeRecord
    ).length,
  };

  return { ...payload, rows: reconciled, summary, stripeChecked: true };
}
