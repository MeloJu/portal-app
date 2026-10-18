/**
 * Lê o destino que páginas intermediárias (encurtadores, "safelinks", algumas páginas de anúncio)
 * já entregam no próprio HTML: <meta http-equiv="refresh"> ou um redirecionamento em JavaScript.
 * Só lê o texto recebido: não executa scripts nem acessa outros endereços.
 */
type Options = {
  /** Aceita redirecionamento em JavaScript (só para páginas de anúncio ou páginas-ponte pequenas). */
  allowScript: boolean;
};

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", "#x2F": "/", "#47": "/" };

function decodeEntities(text: string): string {
  return text.replace(/&(amp|quot|apos|lt|gt|#x2F|#47);/gi, (match, name: string) => ENTITIES[name] ?? ENTITIES[name.toLowerCase()] ?? match);
}

function decodeJsString(text: string): string {
  return text
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\(.)/g, "$1");
}

function asHttpUrl(text: string, base: URL): URL | null {
  try {
    const url = new URL(text.trim(), base);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function metaRefresh(html: string): string | null {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (!/http-equiv\s*=\s*["']?refresh/i.test(tag)) continue;
    const content = /content\s*=\s*(["'])(.*?)\1/i.exec(tag)?.[2] ?? /content\s*=\s*([^\s>]+)/i.exec(tag)?.[1];
    const target = content && /url\s*=\s*['"]?([^'"]+)/i.exec(decodeEntities(content))?.[1];
    if (target) return target;
  }
  return null;
}

const SCRIPT_REDIRECTS = [
  // location = "...", window.location.href = "...", top.location = '...'
  /(?:window\.|document\.|top\.|self\.)?location(?:\.href)?\s*=\s*(["'`])((?:\\.|(?!\1).)+)\1/g,
  // location.replace("..."), location.assign('...')
  /location\.(?:replace|assign)\(\s*(["'`])((?:\\.|(?!\1).)+)\1\s*\)/g,
];

function scriptRedirect(html: string): string[] {
  const found: string[] = [];
  for (const pattern of SCRIPT_REDIRECTS) {
    for (const match of html.matchAll(pattern)) found.push(decodeJsString(match[2]));
  }
  return found;
}

export function extractDestinationFromHtml(html: string, page: URL, opts: Options): URL | null {
  const candidates: string[] = [];
  const refresh = metaRefresh(html);
  if (refresh) candidates.push(refresh);
  if (opts.allowScript) candidates.push(...scriptRedirect(html));

  for (const candidate of candidates) {
    // Template literals com interpolação (`${...}`) não dão para resolver sem executar o script.
    if (candidate.includes("${")) continue;
    const url = asHttpUrl(candidate, page);
    if (url && url.href !== page.href) return url;
  }
  return null;
}
