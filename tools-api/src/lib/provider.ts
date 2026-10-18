/**
 * Serviço externo de bypass acessado pela API oficial dele, com chave contratada.
 * A Lumi só pergunta o destino de um link com anúncio; o crédito ao serviço vai junto na resposta.
 *
 * BYPASS_API_URL    endereço da API. Com "{url}" no texto, faz GET trocando "{url}" pelo link;
 *                   sem, faz POST com { "url": "<link>" }.
 * BYPASS_API_KEY    chave da API (só no servidor). Opcional: serviços abertos, sem chave, funcionam sem ela.
 * BYPASS_API_KEY_HEADER   cabeçalho da chave (padrão: x-api-key).
 * BYPASS_PROVIDER_NAME / BYPASS_PROVIDER_SITE   crédito mostrado na tela (padrão: bypass.city).
 */
export type Provider = { name: string; site: string };
export type GateResolution = { destination: URL; provider: Provider };
export type GateResolver = (gate: URL, signal: AbortSignal) => Promise<GateResolution | null>;

type Config = {
  apiUrl?: string;
  apiKey?: string;
  keyHeader?: string;
  name?: string;
  site?: string;
  fetchFn?: typeof fetch;
};

/** Campos onde serviços desse tipo costumam devolver o destino. */
const RESULT_FIELDS = ["destination", "result", "bypassed", "url", "link", "target", "data"];

function asHttpUrl(value: unknown): URL | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function findDestination(body: unknown, depth = 0): URL | null {
  const direct = asHttpUrl(body);
  if (direct || depth > 2 || typeof body !== "object" || body === null) return direct;
  for (const field of RESULT_FIELDS) {
    const found = findDestination((body as Record<string, unknown>)[field], depth + 1);
    if (found) return found;
  }
  return null;
}

/** Devolve null quando não há serviço configurado: aí a tela usa o quadro do bypass.city. */
export function createGateResolver(config: Config = {}): GateResolver | null {
  const {
    apiUrl = process.env.BYPASS_API_URL,
    apiKey = process.env.BYPASS_API_KEY,
    keyHeader = process.env.BYPASS_API_KEY_HEADER || "x-api-key",
    name = process.env.BYPASS_PROVIDER_NAME || "bypass.city",
    site = process.env.BYPASS_PROVIDER_SITE || "https://bypass.city/",
    fetchFn = fetch,
  } = config;
  if (!apiUrl) return null;
  const provider = { name, site };

  return async (gate, signal) => {
    const usesGet = apiUrl.includes("{url}");
    const res = await fetchFn(usesGet ? apiUrl.replace("{url}", encodeURIComponent(gate.href)) : apiUrl, {
      method: usesGet ? "GET" : "POST",
      headers: {
        accept: "application/json",
        ...(apiKey ? { [keyHeader]: apiKey } : {}),
        ...(usesGet ? {} : { "content-type": "application/json" }),
      },
      body: usesGet ? undefined : JSON.stringify({ url: gate.href }),
      signal,
    });
    if (!res.ok) return null;
    const destination = findDestination(await res.json().catch(() => null));
    // O serviço devolver o próprio link de anúncio não revela nada.
    if (!destination || destination.href === gate.href) return null;
    return { destination, provider };
  };
}
