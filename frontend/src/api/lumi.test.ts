import { afterEach, describe, expect, it, vi } from "vitest";
import { request } from "./client";
import { api } from "./lumi";

vi.mock("./client", () => ({ request: vi.fn().mockResolvedValue(undefined) }));

afterEach(() => vi.mocked(request).mockClear());

describe("api/lumi", () => {
  it("listLinks monta a query só com o que veio", async () => {
    await api.listLinks({ state: "PAUSED", size: 50 });
    expect(request).toHaveBeenLastCalledWith("/api/links?state=PAUSED&size=50");

    await api.listLinks();
    expect(request).toHaveBeenLastCalledWith("/api/links");
  });

  it("travel codifica o código", async () => {
    await api.travel("a b");
    expect(request).toHaveBeenCalledWith("/api/travel/a%20b");
  });

  it("updateLink usa PATCH com o corpo", async () => {
    await api.updateLink("x", { paused: true });
    expect(request).toHaveBeenCalledWith("/api/links/x", { method: "PATCH", body: { paused: true } });
  });

  it.each([
    [
      "register",
      () => api.register("Ana", "ana@lumi.studio", "segredo-grande"),
      "/api/auth/register",
      { method: "POST", body: { name: "Ana", email: "ana@lumi.studio", password: "segredo-grande" } },
    ],
    [
      "login",
      () => api.login("ana@lumi.studio", "segredo-grande"),
      "/api/auth/login",
      { method: "POST", body: { email: "ana@lumi.studio", password: "segredo-grande" } },
    ],
    ["logout", () => api.logout(), "/api/auth/logout", { method: "POST" }],
    [
      "createLink",
      () => api.createLink({ targetUrl: "facebook.com", alias: "promo" }),
      "/api/links",
      { method: "POST", body: { targetUrl: "facebook.com", alias: "promo" } },
    ],
    ["closeLink", () => api.closeLink("a/b"), "/api/links/a%2Fb", { method: "DELETE" }],
  ])("%s chama o endpoint com método e corpo", async (_name, fn, path, init) => {
    await fn();
    expect(request).toHaveBeenCalledWith(path, init);
  });

  it.each([
    ["me", () => api.me(), "/api/me"],
    ["getLink", () => api.getLink("aB3x9Q"), "/api/links/aB3x9Q"],
    ["linkStats", () => api.linkStats("aB3x9Q", 12), "/api/links/aB3x9Q/stats?days=12"],
    ["linkStats sem days", () => api.linkStats("aB3x9Q"), "/api/links/aB3x9Q/stats"],
    ["dashboardSummary", () => api.dashboardSummary(30), "/api/dashboard/summary?days=30"],
    ["dashboardTravels", () => api.dashboardTravels(12), "/api/dashboard/travels?days=12"],
    ["topLinks", () => api.topLinks(5), "/api/dashboard/top-links?limit=5"],
    ["countries", () => api.countries(), "/api/dashboard/countries"],
    ["protectionSummary", () => api.protectionSummary(), "/api/protection/summary"],
    ["protectionEvents", () => api.protectionEvents(20), "/api/protection/events?limit=20"],
  ])("%s faz GET em %s", async (_name, fn, path) => {
    await fn();
    expect(request).toHaveBeenCalledWith(path);
  });

  it("devolve o que o request resolveu", async () => {
    const user = { id: "u1", name: "Ana", email: "ana@lumi.studio" };
    vi.mocked(request).mockResolvedValueOnce(user);
    await expect(api.me()).resolves.toEqual(user);
  });
});
