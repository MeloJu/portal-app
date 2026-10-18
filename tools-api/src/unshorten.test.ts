import { describe, expect, it } from "vitest";
import { ApiError } from "./errors.ts";
import type { BrowserResolver } from "./lib/browser.ts";
import type { GateResolver } from "./lib/provider.ts";
import { unshorten, type HopFetcher } from "./unshorten.ts";

/** Monta um fetcher a partir de um mapa url -> [status, location, corpo HTML?]. */
function fake(map: Record<string, [number, string | null, string?]>): HopFetcher {
  return async (url) => {
    const entry = map[url];
    if (!entry) throw new Error(`sem rota para ${url}`);
    return { status: entry[0], location: entry[1], body: entry[2] };
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

  it("devolve a página do anúncio quando ela não revela o destino", async () => {
    const fetchHop = fake({ "https://linkvertise.com/514008/abc": [200, null, "<html><div id='app'></div></html>"] });
    const err = (await unshorten("https://linkvertise.com/514008/abc", { fetchHop }).catch((e) => e)) as ApiError;
    expect(err.code).toBe("AD_GATED");
    expect(err.details).toEqual({ gateUrl: "https://linkvertise.com/514008/abc" });
  });

  it("devolve a página do anúncio quando o serviço recusa a Lumi", async () => {
    const fetchHop: HopFetcher = async () => {
      throw new Error("ECONNRESET");
    };
    expect(await code(unshorten("https://work.ink/1abc/x", { fetchHop }))).toBe("AD_GATED");
  });

  it("revela o destino que a página do anúncio traz no script", async () => {
    const gate = "https://sub2unlock.com/abc";
    const r = await unshorten(gate, {
      fetchHop: fake({
        [gate]: [200, null, `<script>setTimeout(() => window.location.href = "https://exemplo.com/arquivo", 5000)</script>`],
        "https://exemplo.com/arquivo": [200, null],
      }),
    });
    expect(r.finalUrl).toBe("https://exemplo.com/arquivo");
    expect(r.resolvedBy).toBe("page");
    expect(r.hops[0]).toEqual({ url: gate, status: 200, kind: "page" });
  });

  it("não aceita como destino outra etapa do mesmo anúncio", async () => {
    const gate = "https://ouo.io/abc";
    const fetchHop = fake({ [gate]: [200, null, `<script>location.href = "https://ouo.io/go/abc"</script>`] });
    expect(await code(unshorten(gate, { fetchHop }))).toBe("AD_GATED");
  });

  describe("serviço de bypass", () => {
    const provider = { name: "bypass.city", site: "https://bypass.city/" };
    const gate = "https://linkvertise.com/514008/abc";
    const gatePage = "<html><div id='app'></div></html>";

    it("pergunta ao serviço quando a página do anúncio não revela o destino", async () => {
      const asked: string[] = [];
      const resolveGate: GateResolver = async (url) => (asked.push(url.href), { destination: new URL("https://bit.ly/real"), provider });
      const r = await unshorten(gate, {
        resolveGate,
        fetchHop: fake({
          [gate]: [200, null, gatePage],
          "https://bit.ly/real": [301, "https://exemplo.com/arquivo.zip"],
          "https://exemplo.com/arquivo.zip": [200, null],
        }),
      });
      expect(asked).toEqual([gate]);
      expect(r.finalUrl).toBe("https://exemplo.com/arquivo.zip");
      expect(r.resolvedBy).toBe("provider");
      expect(r.provider).toEqual(provider);
      expect(r.hops.map((h) => h.kind ?? h.status)).toEqual(["provider", 301, 200]);
    });

    it("não pergunta ao serviço quando o destino já está no link", async () => {
      let asked = false;
      const resolveGate: GateResolver = async () => ((asked = true), null);
      const dynamic = "https://link-to.net/1/2/dynamic?r=aHR0cHM6Ly9nb29nbGUuY29t";
      const r = await unshorten(dynamic, { resolveGate, fetchHop: fake({ "https://google.com/": [200, null] }) });
      expect(r.finalUrl).toBe("https://google.com/");
      expect(r.provider).toBeUndefined();
      expect(asked).toBe(false);
    });

    it("pergunta ao serviço mesmo quando o anúncio bloqueia a Lumi", async () => {
      const fetchHop: HopFetcher = async (url) => {
        if (url === gate) throw new Error("403 cloudflare");
        return { status: 200, location: null };
      };
      const resolveGate: GateResolver = async () => ({ destination: new URL("https://exemplo.com/"), provider });
      expect((await unshorten(gate, { fetchHop, resolveGate })).finalUrl).toBe("https://exemplo.com/");
    });

    it("volta para AD_GATED quando o serviço falha", async () => {
      const resolveGate: GateResolver = async () => {
        throw new Error("500");
      };
      expect(await code(unshorten(gate, { resolveGate, fetchHop: fake({ [gate]: [200, null, gatePage] }) }))).toBe("AD_GATED");
    });

    it("não segue destino interno devolvido pelo serviço (SSRF)", async () => {
      const resolveGate: GateResolver = async () => ({ destination: new URL("http://10.0.0.1/admin"), provider });
      expect(await code(unshorten(gate, { resolveGate, fetchHop: fake({ [gate]: [200, null, gatePage] }) }))).toBe(
        "FORBIDDEN_HOST",
      );
    });
  });

  describe("endereço revelado que a Lumi não alcança", () => {
    const provider = { name: "rip.linkvertise.lol", site: "https://rip.linkvertise.lol/" };
    const gate = "https://linkvertise.com/514008/abc";
    const gatePage = "<html><div id='app'></div></html>";

    it("mostra o destino revelado pelo serviço mesmo quando ele não responde", async () => {
      const resolveGate: GateResolver = async () => ({ destination: new URL("https://exemplo.com/privado"), provider });
      const fetchHop: HopFetcher = async (url) => {
        if (url === gate) return { status: 200, location: null, body: gatePage };
        throw new Error("403");
      };
      const r = await unshorten(gate, { fetchHop, resolveGate, resolveInBrowser: null });
      expect(r.finalUrl).toBe("https://exemplo.com/privado");
      expect(r.provider).toEqual(provider);
      expect(r.hops.map((h) => h.kind ?? h.status)).toEqual(["provider", 0]);
    });

    it("não acessa endereço de verificação de etapa (key system)", async () => {
      const requested: string[] = [];
      const resolveGate: GateResolver = async () => ({
        destination: new URL("https://api.hydrogen.sh/gateway/callback?stage=1"),
        provider,
      });
      const fetchHop: HopFetcher = async (url) => {
        requested.push(url);
        return { status: 200, location: null, body: gatePage };
      };
      const r = await unshorten(gate, { fetchHop, resolveGate, resolveInBrowser: null });
      expect(r.finalUrl).toBe("https://api.hydrogen.sh/gateway/callback?stage=1");
      expect(requested).toEqual([gate]);
    });

    it("continua dando erro quando o primeiro link comum não responde", async () => {
      const fetchHop: HopFetcher = async () => {
        throw new Error("ECONNREFUSED");
      };
      expect(await code(unshorten("https://a.com/", { fetchHop, resolveGate: null, resolveInBrowser: null }))).toBe("UPSTREAM_ERROR");
    });
  });

  describe("navegador headless", () => {
    const provider = { name: "bypass.city", site: "https://bypass.city/" };
    const gate = "https://linkvertise.com/514008/abc";
    const gatePage = "<html><div id='app'></div></html>";

    it("abre a página no navegador quando o HTML não revela o destino", async () => {
      const resolveInBrowser: BrowserResolver = async () => new URL("https://exemplo.com/");
      const r = await unshorten(gate, {
        resolveInBrowser,
        resolveGate: null,
        fetchHop: fake({ [gate]: [200, null, gatePage], "https://exemplo.com/": [200, null] }),
      });
      expect(r.finalUrl).toBe("https://exemplo.com/");
      expect(r.resolvedBy).toBe("browser");
      expect(r.hops.map((h) => h.kind ?? h.status)).toEqual(["browser", 200]);
    });

    it("usa o serviço de bypass quando o navegador não acha o destino (ex.: captcha)", async () => {
      const resolveInBrowser: BrowserResolver = async () => null;
      const resolveGate: GateResolver = async () => ({ destination: new URL("https://exemplo.com/"), provider });
      const r = await unshorten(gate, {
        resolveInBrowser,
        resolveGate,
        fetchHop: fake({ [gate]: [200, null, gatePage], "https://exemplo.com/": [200, null] }),
      });
      expect(r.resolvedBy).toBe("provider");
    });

    it("volta para AD_GATED quando o navegador falha", async () => {
      const resolveInBrowser: BrowserResolver = async () => {
        throw new Error("navegador não encontrado");
      };
      const fetchHop = fake({ [gate]: [200, null, gatePage] });
      expect(await code(unshorten(gate, { resolveInBrowser, resolveGate: null, fetchHop }))).toBe("AD_GATED");
    });

    it("não segue destino interno achado pelo navegador (SSRF)", async () => {
      const resolveInBrowser: BrowserResolver = async () => new URL("http://192.168.0.1/");
      const fetchHop = fake({ [gate]: [200, null, gatePage] });
      expect(await code(unshorten(gate, { resolveInBrowser, resolveGate: null, fetchHop }))).toBe("FORBIDDEN_HOST");
    });

    it("não abre o navegador para links comuns", async () => {
      let opened = false;
      const resolveInBrowser: BrowserResolver = async () => ((opened = true), null);
      await unshorten("https://example.com/", { resolveInBrowser, fetchHop: fake({ "https://example.com/": [200, null, gatePage] }) });
      expect(opened).toBe(false);
    });
  });

  it("segue meta refresh de encurtadores comuns", async () => {
    const r = await unshorten("https://encurta.com/x", {
      fetchHop: fake({
        "https://encurta.com/x": [200, null, `<meta http-equiv="refresh" content="0;url=https://exemplo.com/fim">`],
        "https://exemplo.com/fim": [200, null, "<html>destino</html>"],
      }),
    });
    expect(r.finalUrl).toBe("https://exemplo.com/fim");
    expect(r.hops.map((h) => h.kind)).toEqual(["page", undefined]);
  });

  it("não trata location= de páginas grandes comuns como redirecionamento", async () => {
    const big = `<script>if (x) location.href = "https://outro.com/"</script>${"<p>conteúdo</p>".repeat(500)}`;
    const r = await unshorten("https://site.com/", { fetchHop: fake({ "https://site.com/": [200, null, big] }) });
    expect(r.finalUrl).toBe("https://site.com/");
  });

  it("não segue meta refresh para host interno (SSRF)", async () => {
    const fetchHop = fake({
      "https://a.com/": [200, null, `<meta http-equiv="refresh" content="0;url=http://169.254.169.254/latest">`],
    });
    expect(await code(unshorten("https://a.com/", { fetchHop }))).toBe("FORBIDDEN_HOST");
  });

  it("detecta o anúncio quando um encurtador comum redireciona para ele", async () => {
    const fetchHop = fake({ "https://bit.ly/x": [301, "https://work.ink/1abc/destino"] });
    const err = (await unshorten("bit.ly/x", { fetchHop }).catch((e) => e)) as ApiError;
    expect(err.code).toBe("AD_GATED");
    expect(err.details).toEqual({ gateUrl: "https://work.ink/1abc/destino" });
  });

  it("revela o destino embutido em link com anúncio sem acessar o serviço", async () => {
    const dynamic = "https://link-to.net/65354/941.87/dynamic?r=aHR0cHM6Ly9nb29nbGUuY29t";
    const requested: string[] = [];
    const fetchHop: HopFetcher = async (url) => (requested.push(url), { status: 200, location: null });

    const r = await unshorten(dynamic, { fetchHop });
    expect(r.finalUrl).toBe("https://google.com/");
    expect(r.resolvedBy).toBe("decoded");
    expect(r.hops[0]).toEqual({ url: dynamic, status: 0, kind: "decoded" });
    expect(requested).toEqual(["https://google.com/"]);
  });

  it("continua seguindo redirecionamentos depois de decodificar", async () => {
    const dynamic = `https://link-to.net/1/2/dynamic?r=${Buffer.from("https://bit.ly/z").toString("base64")}`;
    const r = await unshorten(dynamic, {
      fetchHop: fake({ "https://bit.ly/z": [301, "https://exemplo.com/final"], "https://exemplo.com/final": [200, null] }),
    });
    expect(r.finalUrl).toBe("https://exemplo.com/final");
    expect(r.hops.map((h) => h.status)).toEqual([0, 301, 200]);
  });

  it("não decodifica para host interno (SSRF)", async () => {
    const dynamic = `https://link-to.net/1/2/dynamic?r=${Buffer.from("http://169.254.169.254/latest").toString("base64")}`;
    expect(await code(unshorten(dynamic, { fetchHop: fake({}) }))).toBe("FORBIDDEN_HOST");
  });

  it("não decodifica parâmetros de sites comuns", async () => {
    const r = await unshorten("https://site.com/busca?url=https://outro.com/", {
      fetchHop: fake({ "https://site.com/busca?url=https://outro.com/": [200, null] }),
    });
    expect(r.finalUrl).toBe("https://site.com/busca?url=https://outro.com/");
    expect(r.resolvedBy).toBe("redirect");
  });

  it("não confunde domínios parecidos com serviços de anúncio", async () => {
    const r = await unshorten("https://notlinkvertise.com/", { fetchHop: fake({ "https://notlinkvertise.com/": [200, null] }) });
    expect(r.finalUrl).toBe("https://notlinkvertise.com/");
  });
});

describe("unshorten: encurtadores conhecidos com destino no endereço", () => {
  it("lê o destino do link sem acessar o encurtador", async () => {
    const requested: string[] = [];
    const fetchHop: HopFetcher = async (url) => (requested.push(url), { status: 200, location: null });
    const link = `https://sfl.gl/abc?u=${Buffer.from("https://exemplo.com/arquivo").toString("base64")}`;
    const r = await unshorten(link, { fetchHop, resolveGate: null, resolveInBrowser: null });
    expect(r.finalUrl).toBe("https://exemplo.com/arquivo");
    expect(r.resolvedBy).toBe("decoded");
    expect(requested).toEqual(["https://exemplo.com/arquivo"]);
  });

  it("não segue destino interno escondido no link (SSRF)", async () => {
    const link = `https://sfl.gl/abc?u=${Buffer.from("http://169.254.169.254/latest").toString("base64")}`;
    expect(await code(unshorten(link, { fetchHop: fake({}), resolveGate: null, resolveInBrowser: null }))).toBe("FORBIDDEN_HOST");
  });
});

describe("unshorten: rastreadores", () => {
  it("devolve os rastreadores da rota e o link limpo", async () => {
    const fetchHop = fake({
      "https://bit.ly/abc?utm_source=zap": [301, "https://loja.com/p?id=7&fbclid=z"],
      "https://loja.com/p?id=7&fbclid=z": [200, null],
    });
    const r = await unshorten("https://bit.ly/abc?utm_source=zap", { fetchHop, resolveGate: null, resolveInBrowser: null });
    expect(r.trackers?.map((t) => [t.name, t.inFinal])).toEqual([
      ["utm_source", false],
      ["fbclid", true],
    ]);
    expect(r.cleanUrl).toBe("https://loja.com/p?id=7");
    expect(r.finalUrl).toBe("https://loja.com/p?id=7&fbclid=z");
  });

  it("usa o analisador injetado em vez do padrão", async () => {
    const analyzeRoute = (route: URL[], final: URL) => ({ cleanUrl: `${route.length}|${final.href}` });
    const r = await unshorten("https://example.com/", { fetchHop: fake({ "https://example.com/": [200, null] }), analyzeRoute });
    expect(r.cleanUrl).toBe("2|https://example.com/");
  });

  it("não inclui trackers nem cleanUrl quando o link é limpo", async () => {
    const r = await unshorten("https://example.com/", { fetchHop: fake({ "https://example.com/": [200, null] }) });
    expect(r.trackers).toBeUndefined();
    expect(r.cleanUrl).toBeUndefined();
  });
});
