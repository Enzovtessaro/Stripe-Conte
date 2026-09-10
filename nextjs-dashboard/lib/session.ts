// Sessão do dashboard assinada com HMAC-SHA256.
//
// O cookie guardava a string "true" e o middleware só conferia esse valor:
// qualquer pessoa criava o cookie no navegador e entrava sem senha. Agora o
// valor é `v1.<expiração>.<assinatura>`, e sem o segredo do servidor não dá
// para gerar uma assinatura válida nem esticar a expiração.
//
// Só Web Crypto: o middleware roda no Edge runtime, sem o crypto do Node.

export const SESSION_COOKIE = 'dashboard_auth';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const TOKEN_VERSION = 'v1';
const encoder = new TextEncoder();

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// A chave deriva da senha do dashboard: trocar a senha derruba todas as sessões
// abertas, e produção não precisa de mais uma variável de ambiente.
async function getSigningKey(): Promise<CryptoKey | null> {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return null;

  const secret = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`dashboard-session:${TOKEN_VERSION}:${password}`)
  );

  return crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
}

async function sign(payload: string, key: CryptoKey): Promise<string> {
  return toBase64Url(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Compara digests de tamanho fixo, para o tempo de resposta não vazar nem o
// conteúdo nem o tamanho da senha.
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  return timingSafeEqual(toBase64Url(digestA), toBase64Url(digestB));
}

export async function createSessionToken(now: number = Date.now()): Promise<string | null> {
  const key = await getSigningKey();
  if (!key) return null;

  const expiresAt = Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `${TOKEN_VERSION}.${expiresAt}`;
  return `${payload}.${await sign(payload, key)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  now: number = Date.now()
): Promise<boolean> {
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return false;

  const expiresAt = Number(parts[1]);
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) return false;

  // Sem senha configurada ninguém entra: falha fechada.
  const key = await getSigningKey();
  if (!key) return false;

  const expected = await sign(`${parts[0]}.${parts[1]}`, key);
  return timingSafeEqual(expected, parts[2]);
}
