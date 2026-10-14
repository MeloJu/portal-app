import { ApiError } from "./errors.ts";
import { parsePublicUrl } from "./lib/ssrf.ts";

export type Verdict = "clean" | "suspicious" | "malicious";
type Stats = { malicious: number; suspicious: number; harmless: number; undetected: number };
export type ScanResult = { url: string; verdict: Verdict; stats: Stats; permalink: string };

type Options = { apiKey?: string; fetchFn?: typeof fetch; pollMs?: number; maxPolls?: number };

const VT = "https://www.virustotal.com/api/v3";

export const vtId = (url: string) => Buffer.from(url).toString("base64url");

export function toVerdict(stats: { malicious: number; suspicious: number }): Verdict {
  if (stats.malicious > 0) return "malicious";
  if (stats.suspicious > 0) return "suspicious";
  return "clean";
}

export async function scanUrl(raw: unknown, opts: Options = {}): Promise<ScanResult> {
  const { apiKey = process.env.VT_API_KEY, fetchFn = fetch, pollMs = 2000, maxPolls = 5 } = opts;
  if (!apiKey) throw new ApiError(503, "SCAN_NOT_CONFIGURED", "A análise de segurança não está configurada.");
  const url = parsePublicUrl(raw).href;
  const id = vtId(url);

  const build = (stats: Stats): ScanResult => ({
    url,
    verdict: toVerdict(stats),
    stats,
    permalink: `https://www.virustotal.com/gui/url/${id}`,
  });

  const call = async (path: string, init: RequestInit = {}) => {
    let res: Response;
    try {
      res = await fetchFn(`${VT}${path}`, { ...init, headers: { "x-apikey": apiKey, ...init.headers } });
    } catch {
      throw new ApiError(502, "UPSTREAM_ERROR", "Não foi possível consultar o VirusTotal.");
    }
    if (res.status === 429) throw new ApiError(429, "RATE_LIMIT", "Muitas análises agora. Tente de novo em instantes.");
    return res;
  };

  // 1) relatório já existente
  const existing = await call(`/urls/${id}`);
  if (existing.ok) {
    const body = (await existing.json()) as { data: { attributes: { last_analysis_stats: Stats } } };
    return build(body.data.attributes.last_analysis_stats);
  }
  if (existing.status !== 404) throw new ApiError(502, "UPSTREAM_ERROR", "O VirusTotal não respondeu como esperado.");

  // 2) envia para análise e aguarda
  const submit = await call("/urls", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ url }).toString(),
  });
  if (!submit.ok) throw new ApiError(502, "UPSTREAM_ERROR", "O VirusTotal recusou o envio.");
  const analysisId = ((await submit.json()) as { data: { id: string } }).data.id;

  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, pollMs));
    const res = await call(`/analyses/${analysisId}`);
    if (!res.ok) continue;
    const body = (await res.json()) as { data: { attributes: { status: string; stats: Stats } } };
    if (body.data.attributes.status === "completed") return build(body.data.attributes.stats);
  }
  throw new ApiError(504, "TIMEOUT", "A análise ainda está em andamento. Tente novamente em instantes.");
}
