import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthError, currentUser, login, logout, register } from "./auth";
import { isApiOffline } from "./offline";

const user = { id: "u1", name: "Ana Martins", email: "ana@lumi.dev" };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("auth", () => {
  it("faz login com JSON e devolve o usuário", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { expiresIn: 28800, user }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await login("ana@lumi.dev", "segredo")).toEqual(user);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/auth/login");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ email: "ana@lumi.dev", password: "segredo" });
  });

  it("traduz credenciais inválidas em AuthError 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(401, { code: "INVALID_CREDENTIALS", message: "x" })));
    const err = await login("a@b.c", "errada").catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.isInvalidCredentials).toBe(true);
    expect(err.code).toBe("INVALID_CREDENTIALS");
  });

  it("traduz falha de rede em AuthError NETWORK", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const err = await login("a@b.c", "x").catch((e) => e);
    expect(err).toMatchObject({ status: 0, code: "NETWORK" });
  });

  it("cadastra com nome, e-mail e senha e devolve o usuário", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(201, { expiresIn: 28800, user }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await register("Ana Martins", "ana@lumi.dev", "segredo-grande")).toEqual(user);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/auth/register");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ name: "Ana Martins", email: "ana@lumi.dev", password: "segredo-grande" });
  });

  it("cadastro com e-mail repetido vira AuthError 409 com a mensagem da API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json(409, { code: "EMAIL_TAKEN", message: "E-mail já cadastrado" })),
    );
    await expect(register("Ana", "ana@lumi.dev", "segredo-grande")).rejects.toMatchObject({
      status: 409,
      code: "EMAIL_TAKEN",
      message: "E-mail já cadastrado",
    });
  });

  it("currentUser devolve o usuário da sessão", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(200, user)));
    expect(await currentUser()).toEqual(user);
  });

  it("currentUser devolve null sem sessão", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(401, { code: "UNAUTHORIZED" })));
    expect(await currentUser()).toBeNull();
  });

  // O proxy do Vite responde 500 sem corpo quando o backend está desligado; gateways respondem 502/503/504.
  it.each([
    ["sem conexão", "NETWORK", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["500 sem corpo (proxy do Vite)", "OFFLINE", () => Promise.resolve(new Response("", { status: 500 }))],
    ["502", "OFFLINE", () => Promise.resolve(new Response("Bad Gateway", { status: 502 }))],
    ["503", "OFFLINE", () => Promise.resolve(json(503, {}))],
    ["504", "OFFLINE", () => Promise.resolve(new Response("", { status: 504 }))],
  ])("currentUser avisa que a API está fora do ar: %s", async (_, code, reply) => {
    vi.stubGlobal("fetch", vi.fn(reply));
    const err = await currentUser().catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.code).toBe(code);
    expect(isApiOffline(err)).toBe(true);
  });

  it("currentUser repassa outros erros (ex.: 500 da própria API)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(500, { code: "INTERNAL_ERROR" })));
    const err = await currentUser().catch((e) => e);
    expect(err).toMatchObject({ status: 500, code: "INTERNAL_ERROR" });
    expect(isApiOffline(err)).toBe(false);
  });

  it("login com a API fora do ar explica o que aconteceu", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    await expect(login("a@b.c", "x")).rejects.toMatchObject({
      code: "OFFLINE",
      message: expect.stringMatching(/fora do ar/i),
    });
  });

  it("logout encerra a sessão na API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await logout();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST" }));
  });
});
