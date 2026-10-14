import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app.ts";
import { ApiError } from "./errors.ts";

describe("rotas /tools", () => {
  it("GET /tools/health", async () => {
    const res = await request(createApp()).get("/tools/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("POST /tools/unshorten repassa a url e devolve o resultado", async () => {
    const result = { originalUrl: "https://a.co/", finalUrl: "https://b.com/", hops: [], resolvedBy: "redirect" as const };
    const unshorten = vi.fn().mockResolvedValue(result);
    const res = await request(createApp({ unshorten })).post("/tools/unshorten").send({ url: "a.co" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(result);
    expect(unshorten).toHaveBeenCalledWith("a.co");
  });

  it("devolve erros no formato { code, message }", async () => {
    const unshorten = vi.fn().mockRejectedValue(new ApiError(422, "REDIRECT_LOOP", "loop"));
    const res = await request(createApp({ unshorten })).post("/tools/unshorten").send({ url: "x.com" });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ code: "REDIRECT_LOOP", message: "loop" });
  });

  it("POST /tools/unshorten valida de verdade quando o corpo é inválido", async () => {
    const res = await request(createApp()).post("/tools/unshorten").send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_URL");
  });

  it("POST /tools/scan sem chave configurada devolve 503", async () => {
    const prev = process.env.VT_API_KEY;
    delete process.env.VT_API_KEY;
    const res = await request(createApp()).post("/tools/scan").send({ url: "https://a.com" });
    if (prev) process.env.VT_API_KEY = prev;
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("SCAN_NOT_CONFIGURED");
  });

  it("não vaza detalhes de erro inesperado", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const scan = vi.fn().mockRejectedValue(new Error("segredo interno"));
    const res = await request(createApp({ scan })).post("/tools/scan").send({ url: "a.com" });
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("segredo");
  });

  it("aplica limite de requisições por IP", async () => {
    const app = createApp({ unshorten: vi.fn().mockResolvedValue({}) }, { max: 2, windowMs: 60_000 });
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) statuses.push((await request(app).post("/tools/unshorten").send({ url: "a.com" })).status);
    expect(statuses).toEqual([200, 200, 429]);
  });

  it("inclui gateUrl na resposta de erro AD_GATED", async () => {
    const unshorten = vi.fn().mockRejectedValue(new ApiError(422, "AD_GATED", "anúncio", { gateUrl: "https://work.ink/x" }));
    const res = await request(createApp({ unshorten })).post("/tools/unshorten").send({ url: "work.ink/x" });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ code: "AD_GATED", message: "anúncio", gateUrl: "https://work.ink/x" });
  });
});
