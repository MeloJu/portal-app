import { describe, expect, it } from "vitest";
import { createGateResolver, findDestination } from "./provider.ts";

const gate = new URL("https://linkvertise.com/1/abc");
const signal = new AbortController().signal;

/** fetch falso que registra a chamada e responde com o corpo dado. */
function fakeFetch(body: unknown, status = 200) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
}

describe("findDestination", () => {
  it("acha o destino nos campos de resposta mais comuns", () => {
    expect(findDestination({ destination: "https://a.com/" })?.href).toBe("https://a.com/");
    expect(findDestination({ status: "success", result: "https://b.com/x" })?.href).toBe("https://b.com/x");
    expect(findDestination({ data: { url: "https://c.com/" } })?.href).toBe("https://c.com/");
  });

  it("ignora o que não é http/https", () => {
    expect(findDestination({ result: "javascript:alert(1)" })).toBeNull();
    expect(findDestination({ result: "falhou" })).toBeNull();
    expect(findDestination(null)).toBeNull();
  });
});

describe("createGateResolver", () => {
  it("fica desligado sem endereço; a chave é opcional", () => {
    expect(createGateResolver({ apiUrl: "", apiKey: "k" })).toBeNull();
    expect(createGateResolver({ apiUrl: "https://api.x/", apiKey: "" })).toBeTypeOf("function");
  });

  it("faz GET quando o endereço tem {url} e manda a chave no cabeçalho", async () => {
    const { calls, fetchFn } = fakeFetch({ result: "https://destino.com/" });
    const resolve = createGateResolver({ apiUrl: "https://api.x/bypass?url={url}", apiKey: "segredo", fetchFn })!;

    const r = await resolve(gate, signal);
    expect(r?.destination.href).toBe("https://destino.com/");
    expect(r?.provider).toEqual({ name: "bypass.city", site: "https://bypass.city/" });
    expect(calls[0].url).toBe(`https://api.x/bypass?url=${encodeURIComponent(gate.href)}`);
    expect(calls[0].init?.method).toBe("GET");
    expect((calls[0].init?.headers as Record<string, string>)["x-api-key"]).toBe("segredo");
  });

  it("funciona sem chave e não manda cabeçalho de chave", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchFn = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ success: true, result: "https://exemplo.com/arquivo" }), { status: 200 });
    }) as unknown as typeof fetch;
    const resolve = createGateResolver({ apiUrl: "https://api.x/api/bypass?url={url}", fetchFn })!;
    const found = await resolve(new URL("https://linkvertise.com/1/abc"), AbortSignal.timeout(1000));
    expect(found?.destination.href).toBe("https://exemplo.com/arquivo");
    expect(calls[0].url).toBe("https://api.x/api/bypass?url=https%3A%2F%2Flinkvertise.com%2F1%2Fabc");
    expect(Object.keys(calls[0].init?.headers as Record<string, string>)).toEqual(["accept"]);
  });

  it("faz POST com o link no corpo e usa cabeçalho e crédito configurados", async () => {
    const { calls, fetchFn } = fakeFetch({ destination: "https://destino.com/" });
    const resolve = createGateResolver({
      apiUrl: "https://api.y/v1/bypass",
      apiKey: "k",
      keyHeader: "authorization",
      name: "Outro",
      site: "https://outro.dev/",
      fetchFn,
    })!;

    const r = await resolve(gate, signal);
    expect(r?.provider.name).toBe("Outro");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({ url: gate.href });
    expect((calls[0].init?.headers as Record<string, string>).authorization).toBe("k");
  });

  it("devolve null quando o serviço falha ou não revela nada", async () => {
    const opts = { apiUrl: "https://api.x/?u={url}", apiKey: "k" };
    expect(await createGateResolver({ ...opts, fetchFn: fakeFetch({}, 500).fetchFn })!(gate, signal)).toBeNull();
    expect(await createGateResolver({ ...opts, fetchFn: fakeFetch({ error: "x" }).fetchFn })!(gate, signal)).toBeNull();
    expect(await createGateResolver({ ...opts, fetchFn: fakeFetch({ result: gate.href }).fetchFn })!(gate, signal)).toBeNull();
  });
});
