import dns from "node:dns";
import { Agent, fetch as undiciFetch } from "undici";
import { ApiError } from "./errors.ts";
import { assertPublicHost, isPrivateIp, parsePublicUrl } from "./lib/ssrf.ts";

export type Hop = { url: string; status: number };
export type UnshortenResult = {
  originalUrl: string;
  finalUrl: string;
  hops: Hop[];
  resolvedBy: "redirect";
};

/** Faz uma única requisição sem seguir redirecionamento; devolve status e Location. */
export type HopFetcher = (url: string, signal: AbortSignal) => Promise<{ status: number; location: string | null }>;

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
    headers: { "user-agent": "Mozilla/5.0 (compatible; LumiLinks/1.0)" },
  });
  res.body?.cancel().catch(() => {});
  return { status: res.status, location: res.headers.get("location") };
};

type Options = { fetchHop?: HopFetcher; maxHops?: number; timeoutMs?: number };

export async function unshorten(raw: unknown, opts: Options = {}): Promise<UnshortenResult> {
  const { fetchHop = defaultFetcher, maxHops = 10, timeoutMs = 8000 } = opts;
  const start = parsePublicUrl(raw);
  const hops: Hop[] = [];
  const seen = new Set<string>();
  const signal = AbortSignal.timeout(timeoutMs);
  let current = start;

  for (let i = 0; i <= maxHops; i++) {
    if (seen.has(current.href)) throw new ApiError(422, "REDIRECT_LOOP", "O link redireciona em círculo.");
    seen.add(current.href);

    let res: { status: number; location: string | null };
    try {
      res = await fetchHop(current.href, signal);
    } catch {
      if (signal.aborted) throw new ApiError(504, "TIMEOUT", "O destino demorou demais para responder.");
      throw new ApiError(502, "UPSTREAM_ERROR", "Não foi possível acessar o link.");
    }
    hops.push({ url: current.href, status: res.status });

    if (!(res.status >= 300 && res.status < 400 && res.location)) {
      return { originalUrl: start.href, finalUrl: current.href, hops, resolvedBy: "redirect" };
    }

    let next: URL;
    try {
      next = new URL(res.location, current);
    } catch {
      throw new ApiError(502, "UPSTREAM_ERROR", "Redirecionamento inválido.");
    }
    if (next.protocol !== "http:" && next.protocol !== "https:") {
      throw new ApiError(422, "UNSUPPORTED", "O link redireciona para um endereço não suportado.");
    }
    assertPublicHost(next);
    current = next;
  }
  throw new ApiError(422, "TOO_MANY_REDIRECTS", "O link tem redirecionamentos demais.");
}
