import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, request, UNAUTHORIZED_EVENT } from "./client";

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe("api/client", () => {
  it("faz GET com credenciais same-origin e devolve o JSON", async () => {
    const data = { id: 1, email: "a@b.com" };
    const fetchMock = vi.fn().mockResolvedValue(reply(200, data));
    vi.stubGlobal("fetch", fetchMock);

    await expect(request("/api/me")).resolves.toEqual(data);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/me");
    expect(init.credentials).toBe("same-origin");
    expect(init.body).toBeUndefined();
  });

  it("serializa o body em JSON e manda content-type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(201, { code: "abc" }));
    vi.stubGlobal("fetch", fetchMock);

    await request("/api/links", { method: "POST", body: { url: "https://x.com" } });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ url: "https://x.com" });
  });

  it("converte o Error do contrato em ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reply(409, { code: "ALIAS_TAKEN", message: "Esse nome de portal já foi pego" })),
    );
    const err = (await request("/api/links").catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe("ALIAS_TAKEN");
    expect(err.message).toBe("Esse nome de portal já foi pego");
  });

  it("dispara lumi:unauthorized no 401", async () => {
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(401, { code: "UNAUTHORIZED", message: "Faça login" })));

    const err = (await request("/api/me").catch((e) => e)) as ApiError;
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(err.status).toBe(401);
  });

  it.each([403, 500])("não dispara lumi:unauthorized no %i", async (status) => {
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(status, { code: "X", message: "x" })));

    await request("/api/me").catch(() => {});
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
    expect(listener).not.toHaveBeenCalled();
  });

  it("resolve undefined em 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(request("/api/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("converte falha de rede em ApiError NETWORK", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const err = (await request("/api/me").catch((e) => e)) as ApiError;
    expect(err.code).toBe("NETWORK");
    expect(err.status).toBe(0);
  });

  it("relança o erro original quando a requisição é abortada", async () => {
    const abort = new DOMException("Aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));
    const controller = new AbortController();
    controller.abort();
    await expect(request("/api/me", { signal: controller.signal })).rejects.toBe(abort);
  });

  it("tolera resposta de erro sem JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>502</html>", { status: 502 })));
    const err = (await request("/api/me").catch((e) => e)) as ApiError;
    expect(err.status).toBe(502);
    expect(err.code).toBe("UNKNOWN");
  });
});
