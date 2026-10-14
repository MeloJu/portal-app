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

/**
 * Encurtadores sem anúncio de verdade que escondem o destino em base64 no próprio endereço.
 * Cada regra diz onde o texto está: num parâmetro da query ou no fragmento (#), e quantas camadas de base64.
 * Lista conferida a partir do userscript "Bypass All Shortlinks"; só decodifica, não acessa nada.
 */
type Rule = { host: RegExp; path?: RegExp; param?: string; fragment?: boolean; layers?: number };

const KNOWN_SHORTENERS: Rule[] = [
  { host: /^coinilium\.net$/, param: "id" },
  { host: /^(?:blog\.)?klublog\.com$/, param: "safe" },
  { host: /^sfl\.gl$/, param: "u" },
  { host: /^kisalt\.digital$/, param: "u" },
  { host: /^adtival\.network$/, param: "shortid" },
  { host: /^(?:kongutoday|proappapk|hipsonyc)\.com$/, param: "safe" },
  { host: /^(?:ecryptly|equickle)\.com$/, param: "id" },
  { host: /^sharetext\.me$/, path: /^\/redirect/, param: "url" },
  { host: /^comohoy\.com$/, path: /^\/view\/out\.html/, param: "url" },
  { host: /^comohoy\.com$/, param: "url1" },
  { host: /^(?:dw-anime\.net|sphinxanime\.com)$/, path: /^\/short/, param: "anonym" },
  { host: /^mh\.gourlpro\.com$/, fragment: true, layers: 3 },
];

function peel(value: string, layers: number): URL | null {
  let text = value;
  for (let i = 0; i < layers; i++) {
    const next = fromBase64(text);
    if (!next) return null;
    text = next;
  }
  return asHttpUrl(text) ?? asHttpUrl(safeDecodeURIComponent(text));
}

/** Destino de um encurtador conhecido que já o traz no endereço; null se o host não está na lista. */
export function decodeKnownShortener(url: URL): URL | null {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  for (const rule of KNOWN_SHORTENERS) {
    if (!rule.host.test(host) || (rule.path && !rule.path.test(url.pathname))) continue;
    const raw = rule.fragment ? url.hash.replace(/^#!?/, "") : rule.param ? url.searchParams.get(rule.param) : null;
    const destination = raw ? peel(raw, rule.layers ?? 1) : null;
    if (destination && destination.hostname !== url.hostname) return destination;
  }
  return null;
}
