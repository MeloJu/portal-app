import { describe, expect, it } from "vitest";
import { ApiError } from "./errors.ts";
import { unshorten, type HopFetcher } from "./unshorten.ts";

/** Monta um fetcher a partir de um mapa url -> [status, location]. */
function fake(map: Record<string, [number, string | null]>): HopFetcher {
  return async (url) => {
    const entry = map[url];
    if (!entry) throw new Error(`sem rota para ${url}`);
    return { status: entry[0], location: entry[1] };
  };
}

const code = async (p: Promise<unknown>) => ((await p.catch((e) => e)) as ApiError).code;

describe("unshorten", () => {
  it("devolve o destino quando não há redirecionamento", async () => {
    const r = await unshorten("https://example.com/", { fetchHop: fake({ "https://example.com/": [200, null] }) });
    expect(r).toEqual({
      originalUrl: "https://example.com/",
      finalUrl: "https://example.com/",
      hops: [{ url: "https://example.com/", status: 200 }],
      resolvedBy: "redirect",
    });
  });

  it("segue a cadeia de redirecionamentos e registra cada salto", async () => {
    const r = await unshorten("bit.ly/abc", {
      fetchHop: fake({
        "https://bit.ly/abc": [301, "https://t.co/xyz"],
        "https://t.co/xyz": [302, "/final?a=1"],
        "https://t.co/final?a=1": [200, null],
      }),
    });
    expect(r.finalUrl).toBe("https://t.co/final?a=1");
    expect(r.hops.map((h) => h.status)).toEqual([301, 302, 200]);
  });

  it("detecta loop de redirecionamento", async () => {
    const fetchHop = fake({ "https://a.com/": [302, "https://b.com/"], "https://b.com/": [302, "https://a.com/"] });
    expect(await code(unshorten("https://a.com/", { fetchHop }))).toBe("REDIRECT_LOOP");
  });

  it("limita o número de saltos", async () => {
    const fetchHop: HopFetcher = async (url) => ({ status: 302, location: `${url}x` });
    expect(await code(unshorten("https://a.com/", { fetchHop, maxHops: 3 }))).toBe("TOO_MANY_REDIRECTS");
  });

  it("não segue redirecionamento para host interno (SSRF)", async () => {
    const fetchHop = fake({ "https://a.com/": [302, "http://169.254.169.254/latest/meta-data"] });
    expect(await code(unshorten("https://a.com/", { fetchHop }))).toBe("FORBIDDEN_HOST");
  });

  it("não segue redirecionamento para esquema que não é http/https", async () => {
    const fetchHop = fake({ "https://a.com/": [302, "javascript:alert(1)"] });
    expect(await code(unshorten("https://a.com/", { fetchHop }))).toBe("UNSUPPORTED");
  });

  it("recusa entrada interna antes de qualquer requisição", async () => {
    let called = false;
    const fetchHop: HopFetcher = async () => ((called = true), { status: 200, location: null });
    expect(await code(unshorten("http://127.0.0.1:8080/admin", { fetchHop }))).toBe("FORBIDDEN_HOST");
    expect(called).toBe(false);
  });

  it("traduz falha de rede em UPSTREAM_ERROR", async () => {
    const fetchHop: HopFetcher = async () => {
      throw new Error("ECONNREFUSED");
    };
    expect(await code(unshorten("https://a.com/", { fetchHop }))).toBe("UPSTREAM_ERROR");
  });

  it("devolve TIMEOUT quando o destino demora", async () => {
    const fetchHop: HopFetcher = (_url, signal) =>
      new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
    expect(await code(unshorten("https://a.com/", { fetchHop, timeoutMs: 20 }))).toBe("TIMEOUT");
  });
});
