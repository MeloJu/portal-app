/**
 * Lê o destino que alguns links com anúncio já carregam no próprio endereço
 * (ex.: Linkvertise "dinâmico": link-to.net/<id>/<n>/dynamic?r=<base64>).
 * Não acessa nenhum serviço: só decodifica a URL recebida.
 */
const PARAM_NAMES = ["r", "url", "u", "link", "target", "dest", "destination", "redirect", "to", "out", "goto", "s"];

function asHttpUrl(text: string): URL | null {
  try {
    const url = new URL(text.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function safeDecodeURIComponent(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function fromBase64(value: string): string | null {
  // "+" vira espaço ao ler a query string; também aceita a variante URL-safe.
  const normalized = value.replace(/ /g, "+").replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]{8,}={0,2}$/.test(normalized)) return null;
  const text = Buffer.from(normalized, "base64").toString("utf8");
  // Descarta lixo binário: um destino válido é texto imprimível.
  return /^[\x20-\x7e]+$/.test(text) ? text : null;
}

export function decodeEmbeddedDestination(url: URL): URL | null {
  for (const name of PARAM_NAMES) {
    const raw = url.searchParams.get(name);
    if (!raw) continue;

    const candidates = [raw, safeDecodeURIComponent(raw)];
    const decoded = fromBase64(raw);
    if (decoded) candidates.push(decoded, safeDecodeURIComponent(decoded));

    for (const candidate of candidates) {
      const destination = asHttpUrl(candidate);
      if (destination) return destination;
    }
  }
  return null;
}
