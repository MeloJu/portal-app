import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthError, currentUser, login, logout } from "./auth";

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

  it("currentUser devolve o usuário da sessão", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(200, user)));
    expect(await currentUser()).toEqual(user);
  });

  it("currentUser devolve null sem sessão ou sem conexão", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(401, { code: "UNAUTHORIZED" })));
    expect(await currentUser()).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await currentUser()).toBeNull();
  });

  it("currentUser repassa outros erros (ex.: 500)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(500, { code: "INTERNAL_ERROR" })));
    await expect(currentUser()).rejects.toMatchObject({ status: 500 });
  });

  it("logout encerra a sessão na API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await logout();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST" }));
  });
});
