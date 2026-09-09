import { NextResponse } from 'next/server';

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

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Error fetching reconciliation:', error);
    return NextResponse.json({ error: 'Falha ao consultar a conciliação.' }, { status: 502 });
  }
}
