import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./errors.ts";
import { scanUrl, toVerdict, vtId } from "./scan.ts";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const stats = (malicious = 0, suspicious = 0) => ({ malicious, suspicious, harmless: 60, undetected: 10 });
const code = async (p: Promise<unknown>) => ((await p.catch((e) => e)) as ApiError).code;

describe("toVerdict", () => {
  it("classifica pelas estatísticas", () => {
    expect(toVerdict(stats(2, 0))).toBe("malicious");
    expect(toVerdict(stats(0, 1))).toBe("suspicious");
    expect(toVerdict(stats())).toBe("clean");
  });
});

describe("scanUrl", () => {
  it("falha com 503 quando não há chave configurada", async () => {
    expect(await code(scanUrl("https://a.com", { apiKey: "" }))).toBe("SCAN_NOT_CONFIGURED");
  });

  it("recusa host interno sem chamar o VirusTotal", async () => {
    const fetchFn = vi.fn();
    expect(await code(scanUrl("http://127.0.0.1", { apiKey: "k", fetchFn }))).toBe("FORBIDDEN_HOST");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("usa o relatório existente e envia a chave no header", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(200, { data: { attributes: { last_analysis_stats: stats(3) } } }));
    const r = await scanUrl("https://a.com/", { apiKey: "k", fetchFn });
    expect(r.verdict).toBe("malicious");
    expect(r.permalink).toBe(`https://www.virustotal.com/gui/url/${vtId("https://a.com/")}`);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`https://www.virustotal.com/api/v3/urls/${vtId("https://a.com/")}`);
    expect(init.headers["x-apikey"]).toBe("k");
  });

  it("envia para análise quando não há relatório e aguarda a conclusão", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json(404, {}))
      .mockResolvedValueOnce(json(200, { data: { id: "an-1" } }))
      .mockResolvedValueOnce(json(200, { data: { attributes: { status: "queued", stats: stats() } } }))
      .mockResolvedValueOnce(json(200, { data: { attributes: { status: "completed", stats: stats(0, 2) } } }));
    const r = await scanUrl("https://novo.com/", { apiKey: "k", fetchFn, pollMs: 1 });
    expect(r.verdict).toBe("suspicious");
    expect(fetchFn.mock.calls[1][1].method).toBe("POST");
  });

  it("devolve TIMEOUT se a análise não conclui a tempo", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json(404, {}))
      .mockResolvedValueOnce(json(200, { data: { id: "an-1" } }))
      .mockImplementation(async () => json(200, { data: { attributes: { status: "queued", stats: stats() } } }));
    expect(await code(scanUrl("https://novo.com/", { apiKey: "k", fetchFn, pollMs: 1, maxPolls: 2 }))).toBe("TIMEOUT");
  });

  it("repassa o limite de taxa do VirusTotal como RATE_LIMIT", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(429, {}));
    expect(await code(scanUrl("https://a.com/", { apiKey: "k", fetchFn }))).toBe("RATE_LIMIT");
  });

  it("traduz falha de rede em UPSTREAM_ERROR", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("down"));
    expect(await code(scanUrl("https://a.com/", { apiKey: "k", fetchFn }))).toBe("UPSTREAM_ERROR");
  });
});
