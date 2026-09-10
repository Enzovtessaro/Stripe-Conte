import { NextResponse } from 'next/server';
import { getPaidInvoicesForCycleMonth, getSubscriptionCoverage } from '@/lib/stripe';

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
  let coverage: Awaited<ReturnType<typeof getSubscriptionCoverage>>;
  try {
    [invoices, coverage] = await Promise.all([
      getPaidInvoicesForCycleMonth(month, year),
      getSubscriptionCoverage(),
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

  // Uma assinatura pode cobrir mais de uma empresa do cadastro: Selbach
  // Servicos + Joao Vitor Selbach dividem sub_1TPS2L (R$ 110 + R$ 249 = R$ 359)
  // e RYN + ANRN dividem outra (R$ 120 + R$ 120 = R$ 240). Nesses casos o email
  // aponta para varias linhas, e a fatura cobre TODAS — nao e ambiguidade, e
  // cobranca compartilhada. A soma dos valores do grupo bater com o valor
  // cobrado no Stripe e o que confirma que sao a mesma assinatura.
  const rowsByEmail = new Map<string, ReconciliationRow[]>();
  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    if (!email) continue;
    const group = rowsByEmail.get(email) ?? [];
    group.push(row);
    rowsByEmail.set(email, group);
  }

  // Linhas que apontam para o MESMO cliente do Stripe sao, por definicao, o
  // mesmo pagador: uma cobranca dele cobre todas. Sinal mais forte que o email,
  // e resolve o caso em que o valor de uma das linhas esta desatualizado no
  // cadastro (em agosto/2026 a linha da Selbach Servicos guardava R$ 359, o
  // valor cheio da assinatura, no lugar da fatia de R$ 249).
  const rowsByCustomer = new Map<string, ReconciliationRow[]>();
  for (const row of rows) {
    if (!row.stripeCustomerId) continue;
    const group = rowsByCustomer.get(row.stripeCustomerId) ?? [];
    group.push(row);
    rowsByCustomer.set(row.stripeCustomerId, group);
  }

  const AMOUNT_TOLERANCE = 1;

  function grupoBateComValor(email: string, stripeAmount: number): boolean {
    const group = rowsByEmail.get(email);
    if (!group) return false;
    if (group.length === 1) return true;
    const soma = group.reduce((sum, r) => sum + (r.amount ?? 0), 0);
    return Math.abs(soma - stripeAmount) <= AMOUNT_TOLERANCE;
  }

  const reconciled = rows.map((row) => {
    if (row.status === 'pago') return row;

    const email = row.email?.trim().toLowerCase() ?? '';

    const paidMatch =
      (row.stripeCustomerId && paidByCustomerId.get(row.stripeCustomerId)) ||
      (() => {
        const byEmail = paidByEmail.get(email);
        return byEmail && grupoBateComValor(email, byEmail.amount) ? byEmail : undefined;
      })();

    if (paidMatch) {
      return {
        ...row,
        status: 'pago' as const,
        method: 'cartao' as const,
        paidAt: paidMatch.paidAt,
        amount: row.amount || paidMatch.amount,
        missingBackofficeRecord: true,
      };
    }

    // Assinatura ativa cujo ciclo ainda nao virou neste mes: a cobranca esta
    // por vir, nao esta em atraso. O cadastro pode apontar para um cliente
    // Stripe antigo (Selbach), entao o email tambem vale como chave.
    const sub =
      (row.stripeCustomerId && coverage.byCustomer.get(row.stripeCustomerId)) ||
      (() => {
        const byEmail = coverage.byEmail.get(email);
        return byEmail && grupoBateComValor(email, byEmail.amount) ? byEmail : undefined;
      })();

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

  // Assinatura compartilhada: o backoffice registra o pagamento em UMA das
  // empresas (em agosto/2026, a linha da Selbach Servicos com os R$ 359 cheios)
  // e a irma fica sem linha nenhuma, aparecendo como se nao tivesse sido
  // cobrada. Se uma linha do mesmo pagador esta paga, a cobranca cobriu as duas.
  const pagoPorCliente = new Map<string, ReconciliationRow>();
  for (const row of reconciled) {
    if (row.status !== 'pago' || !row.stripeCustomerId) continue;
    if (!pagoPorCliente.has(row.stripeCustomerId)) {
      pagoPorCliente.set(row.stripeCustomerId, row);
    }
  }

  const comCompartilhada = reconciled.map((row) => {
    if (row.status === 'pago' || !row.stripeCustomerId) return row;

    const irmaos = rowsByCustomer.get(row.stripeCustomerId);
    if (!irmaos || irmaos.length < 2) return row;

    const irmaoPago = pagoPorCliente.get(row.stripeCustomerId);
    if (!irmaoPago) return row;

    return {
      ...row,
      status: 'pago' as const,
      method: 'cartao' as const,
      paidAt: irmaoPago.paidAt,
      // Coberta pela assinatura da empresa irma, no mesmo cliente do Stripe.
      sharedSubscriptionWith: irmaoPago.companyName,
    };
  });

  const summary = {
    total: comCompartilhada.length,
    pago: comCompartilhada.filter((r) => r.status === 'pago').length,
    aguardando: comCompartilhada.filter((r) => r.status === 'aguardando').length,
    naoPago: comCompartilhada.filter((r) => r.status === 'nao_pago').length,
    semCobranca: comCompartilhada.filter((r) => r.status === 'sem_cobranca').length,
    valorPago: reconciled
      .filter((r) => r.status === 'pago')
      .reduce((sum, r) => sum + (r.amount ?? 0), 0),
    valorEsperado: comCompartilhada.reduce((sum, r) => sum + (r.amount ?? 0), 0),
    corrigidosPeloStripe: comCompartilhada.filter(
      (r) => (r as { missingBackofficeRecord?: boolean }).missingBackofficeRecord
    ).length,
  };

  return { ...payload, rows: comCompartilhada, summary, stripeChecked: true };
}
