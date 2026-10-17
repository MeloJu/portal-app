import { afterEach, describe, expect, it, vi } from "vitest";
import { getOverview } from "./dashboard";

const summary = { activeLinks: 3, totalTravels: 42, travelsChangePct: 12.5, blockedThreats: 1 };
const travels = [
  { date: "2026-10-15", travels: 2 },
  { date: "2026-10-16", travels: 5 },
];
const topLinks = [{ code: "abc", title: "Nebulosa", travels: 30 }];

function serve(responses: Record<string, unknown>, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => new Response(JSON.stringify(responses[path] ?? {}), { status })),
  );
}

describe("getOverview", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("junta summary, série de viagens e ranking da Visão geral", async () => {
    serve({
      "/api/dashboard/summary?days=12": summary,
      "/api/dashboard/travels?days=12": travels,
      "/api/dashboard/top-links?limit=3": topLinks,
    });
    await expect(getOverview(12)).resolves.toEqual({ summary, travels, topLinks });
    for (const [, init] of vi.mocked(fetch).mock.calls) {
      expect(init).toMatchObject({ credentials: "same-origin" });
    }
  });

  it("falha se alguma chamada falhar", async () => {
    serve({}, 500);
    await expect(getOverview(12)).rejects.toThrow();
  });
});
