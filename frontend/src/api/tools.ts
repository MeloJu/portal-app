/** Cliente do tools-api (bypass de encurtadores e análise de segurança). */

export type Hop = { url: string; status: number };
export type UnshortenResult = {
  originalUrl: string;
  finalUrl: string;
  hops: Hop[];
  resolvedBy: string;
};

export type Verdict = "clean" | "suspicious" | "malicious";
export type ScanResult = {
  url: string;
  verdict: Verdict;
  stats: { malicious: number; suspicious: number; harmless: number; undetected: number };
  permalink: string;
};

export class ToolsError extends Error {
  status: number;
  code: string;
  /** Em AD_GATED: endereço da página de anúncio, onde o usuário precisa resolver a verificação. */
  gateUrl?: string;

  constructor(status: number, code: string, message: string, gateUrl?: string) {
    super(message);
    this.name = "ToolsError";
    this.status = status;
    this.code = code;
    this.gateUrl = gateUrl;
  }

  get isAdGated() {
    return this.code === "AD_GATED" && Boolean(this.gateUrl);
  }

  /** A análise foi enviada, mas ainda não terminou: vale tentar de novo em instantes. */
  get isPending() {
    return this.code === "ANALYSIS_PENDING";
  }
}

async function post<T>(path: string, url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ToolsError(0, "NETWORK", "Não foi possível falar com a Lumi. Verifique sua conexão e tente de novo.");
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // corpo vazio ou não-JSON: tratado abaixo
  }

  // 202 também carrega { code, message } (análise em andamento).
  if (!res.ok || res.status === 202) {
    const err = (body ?? {}) as { code?: string; message?: string; gateUrl?: string };
    throw new ToolsError(
      res.status,
      err.code ?? "UNKNOWN",
      err.message ?? "Algo deu errado. Tente novamente.",
      typeof err.gateUrl === "string" ? err.gateUrl : undefined,
    );
  }
  return body as T;
}

export const unshorten = (url: string, signal?: AbortSignal) => post<UnshortenResult>("/tools/unshorten", url, signal);
export const scan = (url: string, signal?: AbortSignal) => post<ScanResult>("/tools/scan", url, signal);
