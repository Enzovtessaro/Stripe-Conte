# Integração Abacate Pay

O dashboard agora lê os pagamentos PIX direto da API da Abacate Pay, além do Stripe.

## Configuração

Adicione a chave da API v2 no `.env.local`:

```
ABACATE_PAY_API_KEY=abc_live_...
```

A chave precisa das permissões `CHECKOUT:READ` (cobranças) e `CUSTOMER:READ` (nomes dos clientes).
Ela é criada no dashboard da Abacate em **Integração → Chaves de API**.

Sem a variável o dashboard continua funcionando normalmente — a parte de PIX apenas
volta a mostrar só os registros manuais.

Para conferir a conexão antes de subir:

```bash
node scripts/check-abacate.mjs
```

## O que é lido

| Endpoint | Uso |
| --- | --- |
| `GET /v2/transparents/list` | Cobranças PIX (`pix_char_*`); só as `PAID` e fora de dev mode entram nas métricas |
| `GET /v2/customers/list` | Resolve o nome e e-mail do cliente de cada cobrança |

Valores vêm em centavos e são convertidos para reais. A `platformFee` de cada cobrança
entra como taxa, do mesmo jeito que as taxas do Stripe.

**A data usada é `createdAt`, não `updatedAt`.** Nesta conta os 65 pagamentos têm
`updatedAt` todos em setembro/2026 (algum toque em massa no registro), enquanto o
`createdAt` vai de 25/05 a 08/09 e bate dia a dia com o endpoint de receita da Abacate.
Usar `updatedAt` jogaria a receita inteira no mês corrente.

## A cobrança não identifica o cliente — de onde vem a identidade

`GET /v2/transparents/list` devolve só `id`, `amount`, `status`, `devMode`,
`platformFee`, `receiptUrl`, `createdAt`, `updatedAt`, `expiresAt` e `metadata`.
Nem `customer`, nem `description`.

Isso **não** é falta de dado na origem: a `create-pix-charge` do backoffice já envia
`customer` (nome, e-mail, celular, CNPJ) e `description` ao criar a cobrança. O Abacate
guarda — o painel dele mostra o e-mail — mas não expõe na leitura. Verificado também em
`/v2/transparents/get`, `/v2/transparents/check` e com `include`/`expand`; os endpoints
v1, que expõem mais, recusam chave v2 com "API key version mismatch".

A ponte é a edge function `pix-charge-identities` do repo do conte app, que casa a
cobrança pelo `abacate_pix_id` guardado em `pix_payments` (o mesmo `pix_char_...`) e
devolve empresa, e-mail, plano e o status real do cliente. O `metadata.externalId`
(= `pix_payments.id`) serve como chave alternativa.

Configure as duas variáveis:

```
CONTE_FUNCTIONS_URL=https://<ref>.supabase.co/functions/v1
CONTE_DASHBOARD_TOKEN=...
```

O token é o mesmo `DASHBOARD_METRICS_TOKEN` definido nos secrets do projeto Supabase.

**Com identidade:** clientes novos, ARR, churn, assinantes ativos e mix de planos saem
da Abacate, e o "ativo" vem de `clients.status` — não do palpite de janela de dias.

**Sem as variáveis, ou se a função falhar:** o dashboard mostra a receita, as taxas, os
payouts e o registro de cada pagamento normalmente; só as métricas por cliente ficam de
fora, em vez de saírem inventadas. A receita é idêntica nos dois casos — identidade não
mexe no dinheiro. O código decide sozinho (`hasIdentity` em `lib/abacate-processor.ts`).

## Convivência com os registros manuais

`data/pix-subscriptions.json` guarda 10 assinaturas PIX lançadas à mão, com pagamentos
projetados mês a mês. Os mesmos clientes hoje pagam pela Abacate, então somar as duas
fontes contaria o mesmo dinheiro duas vezes.

A regra aplicada é um **corte por data**:

- O arquivo manual gera receita apenas até o dia anterior ao primeiro pagamento real na
  Abacate — hoje 24/05/2026. Isso derruba a receita manual de R$ 21.257 para R$ 15.383,
  exatamente o pedaço que a Abacate já cobre.
- Desse dia em diante a Abacate é a fonte da verdade **para o dinheiro**.
- Assinantes ativos, ARR, churn e mix de planos saem da Abacate quando a identidade está
  configurada; sem ela, continuam vindo do arquivo manual. Não há duplicidade em nenhum
  dos dois casos — uma fonte contribui zero enquanto a outra contribui.
- Se as cobranças passarem a identificar o cliente, clientes presentes nas duas fontes
  são reconhecidos por nome normalizado (sem acento, pontuação ou sufixo tipo LTDA/MEI)
  e não são contados de novo como cliente novo.

O corte é automático: sai do próprio dado, sem data fixa no código. Se a Abacate ficar
sem pagamentos, o corte some e o arquivo manual volta a valer sozinho.

## Quem é cliente ativo

Com identidade, vem de `clients.status == "ativa"` no backoffice.

Sem identidade, cai num palpite: cliente com pagamento nos últimos **45 dias**
(`ACTIVE_WINDOW_DAYS` em `lib/abacate-processor.ts`). O PIX transparente não tem objeto
de assinatura, então não há nada melhor a fazer nesse caso.

## Detalhes da API

- O header `Accept: application/json` é obrigatório; sem ele a v2 responde HTTP 400.
- A API responde HTTP 400 genérico quando está sob throttle, mesmo com a requisição
  correta. O cliente trata erro devolvendo vazio, então o dashboard não quebra.

## Arquivos

- `lib/abacate.ts` — cliente HTTP da API v2, com paginação por cursor e degradação silenciosa em caso de erro
- `lib/conte-identities.ts` — busca a identidade das cobranças no backoffice do Conte
- `lib/abacate-processor.ts` — transforma cobranças nas métricas do dashboard
- `lib/pix-processor.ts` — registros manuais, agora com corte por data
- `app/api/stripe/route.ts` — junta Stripe + PIX manual + Abacate
- `scripts/check-abacate.mjs` — teste rápido de conexão
