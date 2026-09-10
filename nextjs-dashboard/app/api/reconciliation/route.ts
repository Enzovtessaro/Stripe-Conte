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
    if (Math.abs(soma - stripeAmount) <= AMOUNT_TOLERANCE) return true;
    // O backoffice as vezes grava a cobranca inteira numa empresa so do grupo
    // (agosto/2026: Selbach Servicos com R$ 359, a irma sem fatia). A soma nao
    // fecha, mas um membro carregando sozinho o valor cheio e o mesmo sinal de
    // assinatura compartilhada.
    return group.some((r) => Math.abs((r.amount ?? 0) - stripeAmount) <= AMOUNT_TOLERANCE);
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const todayBrt = new Date((now - 3 * 60 * 60) * 1000).getUTCDate();

  const reconciled = rows.map((row) => {
    const email = row.email?.trim().toLowerCase() ?? '';

    // O cadastro pode apontar para um cliente Stripe antigo (Selbach), entao o
    // email tambem vale como chave quando o grupo bate com o valor cobrado.
    const sub =
      (row.stripeCustomerId && coverage.byCustomer.get(row.stripeCustomerId)) ||
      (() => {
        const byEmail = coverage.byEmail.get(email);
        return byEmail && grupoBateComValor(email, byEmail.amount) ? byEmail : undefined;
      })() ||
      undefined;

    // Para quem paga no cartao, vencimento e o dia em que o Stripe cobra. O
    // data_pagamento do cadastro fica so para PIX e para quem nao tem
    // assinatura. Vale para todas as linhas, inclusive as ja pagas, para a
    // coluna mostrar o mesmo dia em todo mes.
    const stripeDueDay =
      sub && row.method !== 'pix' ? Math.min(sub.billingDay, daysInMonth) : null;
    const base = stripeDueDay !== null ? { ...row, dueDay: stripeDueDay } : row;

    if (base.status === 'pago') return base;

    const paidMatch =
      (row.stripeCustomerId && paidByCustomerId.get(row.stripeCustomerId)) ||
      (() => {
        const byEmail = paidByEmail.get(email);
        return byEmail && grupoBateComValor(email, byEmail.amount) ? byEmail : undefined;
      })();

    if (paidMatch) {
      return {
        ...base,
        status: 'pago' as const,
        method: 'cartao' as const,
        paidAt: paidMatch.paidAt,
        amount: base.amount || paidMatch.amount,
        missingBackofficeRecord: true,
      };
    }

    if (sub && stripeDueDay !== null) {
      const subAtiva = sub.status === 'active' || sub.status === 'trialing';

      // O status tem que seguir o mesmo dia que a coluna mostra: antes (ou no)
      // dia da cobranca do Stripe, esta aguardando — mesmo que o cadastro diga
      // que ja venceu.
      if (subAtiva && isCurrentMonth && todayBrt <= stripeDueDay) {
        return {
          ...base,
          status: 'aguardando' as const,
          method: 'cartao' as const,
          nextChargeAt: new Date(Date.UTC(year, month - 1, stripeDueDay, 12)).toISOString(),
        };
      }

      // O Stripe tentou cobrar e nao conseguiu.
      if (sub.status === 'past_due' || sub.status === 'unpaid') {
        return { ...base, status: 'nao_pago' as const, method: 'cartao' as const };
      }
    }

    return base;
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
