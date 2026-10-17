import { afterEach, describe, expect, it, vi } from "vitest";
import { travel } from "./travel";

function reply(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers })));
}

describe("travel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("registra a Viagem em /api/travel/{code} e devolve o destino", async () => {
    reply(200, { targetUrl: "https://example.com/a", title: "Campanha", travelCount: 7 });
    await expect(travel("aB3x9Q")).resolves.toEqual({
      status: "ok",
      targetUrl: "https://example.com/a",
      title: "Campanha",
      travelCount: 7,
    });
    expect(fetch).toHaveBeenCalledWith("/api/travel/aB3x9Q", expect.objectContaining({ credentials: "same-origin" }));
  });

  it("escapa o código na URL", async () => {
    reply(404);
    await travel("a/b");
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe("/api/travel/a%2Fb");
  });

  it.each([
    [404, "not_found"],
    [423, "paused"],
    [410, "closed"],
  ])("traduz o %i em %s", async (httpStatus, status) => {
    reply(httpStatus, { code: "X", message: "x" });
    await expect(travel("abc")).resolves.toEqual({ status });
  });

  it("no 429 devolve o Retry-After em segundos", async () => {
    reply(429, { code: "RATE_LIMIT" }, { "Retry-After": "42" });
    await expect(travel("abc")).resolves.toEqual({ status: "rate_limited", retryAfter: 42 });
  });

  it("no 429 sem Retry-After devolve retryAfter nulo", async () => {
    reply(429);
    await expect(travel("abc")).resolves.toEqual({ status: "rate_limited", retryAfter: null });
  });

  it("falha de rede ou 5xx viram error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(travel("abc")).resolves.toEqual({ status: "error" });
    reply(500);
    await expect(travel("abc")).resolves.toEqual({ status: "error" });
  });
});
