#!/usr/bin/env node
// Sanity-checks the Abacate Pay connection and prints what the dashboard will see.
// Usage: node scripts/check-abacate.mjs

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // .env.local is optional when the variable is already exported.
  }
}

loadEnvLocal();

const apiKey = process.env.ABACATE_PAY_API_KEY;

if (!apiKey) {
  console.error('ABACATE_PAY_API_KEY nao encontrada em .env.local nem no ambiente.');
  process.exit(1);
}

async function get(path, params = {}) {
  const url = new URL(`https://api.abacatepay.com/v2${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });

  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(`${path} -> HTTP ${response.status}: ${payload.error ?? 'erro desconhecido'}`);
  }

  return payload.data ?? [];
}

async function listAll(path) {
  const out = [];
  let after;

  for (let page = 0; page < 50; page += 1) {
    const batch = await get(path, { limit: 100, after });
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 100) break;
    after = batch[batch.length - 1].id;
  }

  return out;
}

const charges = await listAll('/transparents/list');
const customers = await listAll('/customers/list');

const paid = charges.filter((c) => c.status === 'PAID' && !c.devMode);
const total = paid.reduce((sum, c) => sum + c.amount, 0);
const fees = paid.reduce((sum, c) => sum + (c.platformFee ?? 0), 0);
const dates = paid.map((c) => c.updatedAt || c.createdAt).sort();

console.log('Cobrancas retornadas :', charges.length);
console.log('Pagas (producao)     :', paid.length);
console.log('Receita bruta        : R$', (total / 100).toFixed(2));
console.log('Taxas Abacate        : R$', (fees / 100).toFixed(2));
console.log('Primeiro pagamento   :', dates[0]);
console.log('Ultimo pagamento     :', dates[dates.length - 1]);
console.log('Clientes cadastrados :', customers.length);

const withCustomer = paid.filter((c) => c.customer || c.customerId).length;
console.log('Pagas com cliente    :', withCustomer, `de ${paid.length}`);

console.log('\nCampos de uma cobranca paga:');
console.log(JSON.stringify(paid[0], null, 2).slice(0, 1500));
