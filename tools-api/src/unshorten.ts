import dns from "node:dns";
import { Agent, fetch as undiciFetch } from "undici";
import { ApiError } from "./errors.ts";
import { isAdGate } from "./lib/adgates.ts";
import { createBrowserResolver, type BrowserResolver } from "./lib/browser.ts";
import { decodeEmbeddedDestination, decodeKnownShortener } from "./lib/decode.ts";
import { extractDestinationFromHtml } from "./lib/extract.ts";
import { createGateResolver, type GateResolver, type Provider } from "./lib/provider.ts";
import { assertPublicHost, isPrivateIp, parsePublicUrl } from "./lib/ssrf.ts";
import { analyzeTrackers, type Tracker, type TrackerAnalyzer } from "./lib/trackers.ts";

/**
 * kind "decoded": o próximo salto foi lido do próprio endereço, sem requisição (status 0).
 * kind "page": o próximo salto foi lido do HTML da página (meta refresh ou redirecionamento em script).
 * kind "browser": o próximo salto veio da página aberta no navegador headless (ver lib/browser.ts).
 * kind "provider": o próximo salto veio do serviço externo de bypass (ver lib/provider.ts).
 */
export type HopKind = "decoded" | "page" | "browser" | "provider";
export type Hop = { url: string; status: number; kind?: HopKind };
export type UnshortenResult = {
  originalUrl: string;
  finalUrl: string;
  hops: Hop[];
  resolvedBy: "redirect" | HopKind;
  /** Serviço externo que revelou o destino, para dar o crédito na tela. */
  provider?: Provider;
  /** Rastreadores vistos na rota (parâmetros e domínios); some quando não há nenhum. */
  trackers?: Tracker[];
  /** finalUrl sem os parâmetros de rastreamento; só vem quando algo foi removido. */
  cleanUrl?: string;
};

/** Faz uma única requisição sem seguir redirecionamento; devolve status, Location e, se for HTML, o corpo. */
export type HopFetcher = (
  url: string,
  signal: AbortSignal,
) => Promise<{ status: number; location: string | null; body?: string }>;

/**
 * Endereço de verificação de etapa de um "key system" (…/gateway/callback?stage=1): acessá-lo avisaria o servidor
 * deles de que a etapa foi cumprida. A Lumi mostra o endereço, mas nunca o acessa.
 */
export function isStageCallback(url: URL): boolean {
  return url.pathname.toLowerCase().includes("/callback") && url.searchParams.has("stage");
}

/** Lê no máximo isso do HTML: o redirecionamento costuma estar no começo da página. */
const MAX_BODY_BYTES = 256 * 1024;
/** Páginas-ponte são pequenas; em páginas grandes um location= no script raramente é o redirecionamento. */
const SMALL_PAGE_CHARS = 4096;

/** Sair do for-await antes do fim cancela o restante do corpo. */
async function readLimited(body: AsyncIterable<Uint8Array>, limit: number): Promise<string> {
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  for await (const chunk of body) {
    size += chunk.byteLength;
    text += decoder.decode(chunk, { stream: true });
    if (size >= limit) break;
  }
  return text;
}

// A validação acontece na resolução de DNS, o que também barra DNS rebinding.
const safeAgent = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        const list = addresses as dns.LookupAddress[] | undefined;
        if (err || !list || list.length === 0 || list.some((a) => isPrivateIp(a.address))) {
          return callback(err ?? new Error("blocked address"), [] as never);
        }
        callback(null, list as never);
      });
    },
  },
});

export const defaultFetcher: HopFetcher = async (url, signal) => {
  const res = await undiciFetch(url, {
    method: "GET",
    redirect: "manual",
    signal,
    dispatcher: safeAgent,
    headers: { "user-agent": "Mozilla/5.0 (compatible; LumiLinks/1.0)", accept: "text/html,*/*;q=0.8" },
  });
  const isHtml = /text\/html|application\/xhtml/i.test(res.headers.get("content-type") ?? "");
  if (res.status >= 200 && res.status < 300 && isHtml && res.body) {
    return { status: res.status, location: null, body: await readLimited(res.body, MAX_BODY_BYTES) };
  }
  res.body?.cancel().catch(() => {});
  return { status: res.status, location: res.headers.get("location") };
};

/**
 * resolveGate: serviço de bypass para links com anúncio; null desliga (padrão: o configurado no .env).
 * resolveInBrowser: abre a página de anúncio no navegador headless; null desliga (padrão: BROWSER_RESOLVER).
 */
type Options = {
  fetchHop?: HopFetcher;
  maxHops?: number;
  timeoutMs?: number;
  resolveGate?: GateResolver | null;
  resolveInBrowser?: BrowserResolver | null;
  /** Detecta rastreadores na rota (padrão: lib/trackers.ts). */
  analyzeRoute?: TrackerAnalyzer;
};

const defaultBrowserResolver = createBrowserResolver();

export async function unshorten(raw: unknown, opts: Options = {}): Promise<UnshortenResult> {
  const {
    fetchHop = defaultFetcher,
    maxHops = 10,
    timeoutMs = 30000,
    resolveGate = createGateResolver(),
    resolveInBrowser = defaultBrowserResolver,
    analyzeRoute = analyzeTrackers,
  } = opts;
  const start = parsePublicUrl(raw);
  const hops: Hop[] = [];
  const seen = new Set<string>();
  const signal = AbortSignal.timeout(timeoutMs);
  let current = start;
  let resolvedBy: UnshortenResult["resolvedBy"] = "redirect";
  let provider: Provider | undefined;

  const finish = (status: number): UnshortenResult => {
    hops.push({ url: current.href, status });
    return {
      originalUrl: start.href,
      finalUrl: current.href,
      hops,
      resolvedBy,
      ...(provider && { provider }),
      ...analyzeRoute([start, ...hops.map((hop) => new URL(hop.url))], current),
    };
  };
  /** O salto que trouxe até aqui foi inferido (decodificado, navegador ou serviço), não um redirecionamento HTTP. */
  const reachedByInference = () => ["decoded", "browser", "provider"].includes(hops.at(-1)?.kind ?? "");

  /** Link com anúncio que o HTML não revelou: tenta o navegador, depois o serviço de bypass; sem resposta, AD_GATED. */
  async function resolveAdGate(gate: URL): Promise<URL> {
    if (resolveInBrowser) {
      const found = await resolveInBrowser(gate, signal).catch(() => null);
      if (found) {
        hops.push({ url: gate.href, status: 0, kind: "browser" });
        if (resolvedBy === "redirect") resolvedBy = "browser";
        return found;
      }
    }
    if (resolveGate) {
      const found = await resolveGate(gate, signal).catch(() => null);
      if (found) {
        hops.push({ url: gate.href, status: 0, kind: "provider" });
        resolvedBy = "provider";
        provider = found.provider;
        return found.destination;
      }
    }
    if (signal.aborted) throw new ApiError(504, "TIMEOUT", "O destino demorou demais para responder.");
    throw adGated(gate);
  }

  for (let i = 0; i <= maxHops; i++) {
    if (seen.has(current.href)) throw new ApiError(422, "REDIRECT_LOOP", "O link redireciona em círculo.");
    seen.add(current.href);

    const gated = isAdGate(current.hostname);
    // Alguns links (com anúncio ou encurtadores conhecidos) já trazem o destino no endereço: lê sem acessar o serviço.
    const embedded = (gated && decodeEmbeddedDestination(current)) || decodeKnownShortener(current);
    if (embedded) {
      assertPublicHost(embedded);
      hops.push({ url: current.href, status: 0, kind: "decoded" });
      resolvedBy = "decoded";
      current = embedded;
      continue;
    }

    // Verificação de etapa revelada por um serviço: só mostra, não acessa.
    if (reachedByInference() && isStageCallback(current)) return finish(0);

    let res: Awaited<ReturnType<HopFetcher>>;
    try {
      res = await fetchHop(current.href, signal);
    } catch {
      if (signal.aborted) throw new ApiError(504, "TIMEOUT", "O destino demorou demais para responder.");
      // O endereço revelado pode não responder à Lumi (exige login, bloqueia robôs): ainda vale mostrá-lo.
      if (!gated && reachedByInference()) return finish(0);
      if (!gated) throw new ApiError(502, "UPSTREAM_ERROR", "Não foi possível acessar o link.");
      res = { status: 0, location: null };
    }

    let next: URL | null = null;
    if (res.status >= 300 && res.status < 400 && res.location) {
      try {
        next = new URL(res.location, current);
      } catch {
        throw new ApiError(502, "UPSTREAM_ERROR", "Redirecionamento inválido.");
      }
      hops.push({ url: current.href, status: res.status });
    } else if (res.body) {
      // Sem redirecionamento HTTP: a página pode trazer o destino no HTML (meta refresh / script).
      const allowScript = gated || res.body.length <= SMALL_PAGE_CHARS;
      next = extractDestinationFromHtml(res.body, current, { allowScript });
      // Página de anúncio que só redireciona para si mesma (outra etapa do anúncio) não revela nada.
      if (next && gated && isAdGate(next.hostname) && next.hostname === current.hostname && !decodeEmbeddedDestination(next)) {
        next = null;
      }
      if (next) {
        hops.push({ url: current.href, status: res.status, kind: "page" });
        if (resolvedBy === "redirect") resolvedBy = "page";
      }
    }

    if (!next && gated) next = await resolveAdGate(current);
    if (!next) return finish(res.status);

    if (next.protocol !== "http:" && next.protocol !== "https:") {
      throw new ApiError(422, "UNSUPPORTED", "O link redireciona para um endereço não suportado.");
    }
    assertPublicHost(next);
    current = next;
  }
  throw new ApiError(422, "TOO_MANY_REDIRECTS", "O link tem redirecionamentos demais.");
}

function adGated(gate: URL) {
  return new ApiError(
    422,
    "AD_GATED",
    "Este link passa por uma página de anúncio. Resolva a verificação para revelar o destino.",
    { gateUrl: gate.href },
  );
}
