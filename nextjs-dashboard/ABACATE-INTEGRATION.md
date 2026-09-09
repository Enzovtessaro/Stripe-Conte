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

Valores da API vêm em centavos e são convertidos para reais. A data considerada é
`updatedAt` — o momento em que a cobrança virou `PAID`, não quando o QR Code foi gerado.
A `platformFee` de cada cobrança entra como taxa, do mesmo jeito que as taxas do Stripe.

## Convivência com os registros manuais

`data/pix-subscriptions.json` guarda 10 assinaturas PIX lançadas à mão, com pagamentos
projetados mês a mês. Os mesmos clientes hoje pagam pela Abacate, então somar as duas
fontes contaria o mesmo dinheiro duas vezes.

A regra aplicada é um **corte por data**:

- O arquivo manual gera receita apenas até o dia anterior ao primeiro pagamento real na Abacate.
- Desse dia em diante a Abacate é a fonte da verdade.
- Com o corte ativo, o arquivo manual para de contribuir com assinaturas ativas, ARR,
  churn e mix de planos — essas métricas passam a vir 100% da Abacate.
- Clientes que aparecem nas duas fontes são reconhecidos por nome normalizado
  (sem acento, pontuação ou sufixo tipo LTDA/MEI) e não são contados de novo como
  cliente novo no gráfico de crescimento.

O corte é automático: sai do próprio dado, sem data fixa no código. Se a Abacate ficar
sem pagamentos, o corte some e o arquivo manual volta a valer sozinho.

## Assinatura ativa vs. churn

A Abacate não expõe objeto de assinatura para PIX transparente, então "ativo" é inferido:
cliente com pagamento nos últimos **45 dias** conta como ativo; mais velho que isso conta
como churn. A constante é `ACTIVE_WINDOW_DAYS` em `lib/abacate-processor.ts`.

## Plano do cliente

O nome do plano sai, nesta ordem, de `metadata.plan` / `metadata.planType` / `metadata.plano`,
depois da `description` da cobrança e, se nada existir, do rótulo genérico `PIX Abacate Pay`.
Para o gráfico de receita por plano ficar detalhado, mande `metadata.plan` na hora de criar a cobrança.

## Arquivos

- `lib/abacate.ts` — cliente HTTP da API v2, com paginação por cursor e degradação silenciosa em caso de erro
- `lib/abacate-processor.ts` — transforma cobranças nas métricas do dashboard
- `lib/pix-processor.ts` — registros manuais, agora com corte por data
- `app/api/stripe/route.ts` — junta Stripe + PIX manual + Abacate
- `scripts/check-abacate.mjs` — teste rápido de conexão
