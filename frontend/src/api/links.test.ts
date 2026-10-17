import { afterEach, describe, expect, it, vi } from "vitest";
import { createLink, LinkError } from "./links";

function reply(status: number, body: unknown = {}) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

const link = {
  code: "meu-link",
  shortUrl: "http://localhost:5173/meu-link",
  targetUrl: "https://exemplo.com/longo",
  title: null,
  state: "ACTIVE",
  travelCount: 0,
  expiresAt: null,
  maxTravels: null,
  createdAt: "2026-10-16T12:00:00Z",
};

describe("createLink", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("faz POST /api/links com destino e alias e devolve o Link", async () => {
    reply(201, link);
    await expect(createLink("https://exemplo.com/longo", "meu-link")).resolves.toEqual(link);
    const [path, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(path).toBe("/api/links");
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin" });
    expect(JSON.parse(init!.body as string)).toEqual({ targetUrl: "https://exemplo.com/longo", alias: "meu-link" });
  });

  it("sem alias manda null para a API gerar o código", async () => {
    reply(201, link);
    await createLink("exemplo.com", null);
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)).toEqual({
      targetUrl: "exemplo.com",
      alias: null,
    });
  });

  it.each([
    [400, "INVALID_URL", "Só aceitamos endereços http ou https"],
    [400, "SELF_LOOP", "O destino não pode ser um link da Lumi"],
    [400, "RESERVED_ALIAS", "Esse nome de portal é reservado"],
    [409, "ALIAS_TAKEN", "Esse nome de portal já foi pego"],
  ])("o %i %s vira LinkError com a mensagem da API", async (status, code, message) => {
    reply(status, { code, message });
    const error = await createLink("x", null).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(LinkError);
    expect(error).toMatchObject({ status, code, message });
  });

  it("o VALIDATION_ERROR técnico do alias vira mensagem em português", async () => {
    reply(400, { code: "VALIDATION_ERROR", message: 'alias: must match "^[a-zA-Z0-9-]{3,32}$"' });
    await expect(createLink("x", "a")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "O nome personalizado precisa ter de 3 a 32 letras, números ou hífens.",
    });
  });

  it("sem sessão ou sem rede devolve mensagens próprias", async () => {
    reply(401);
    await expect(createLink("x", null)).rejects.toMatchObject({
      status: 401,
      message: expect.stringMatching(/sessão/i),
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(createLink("x", null)).rejects.toMatchObject({ status: 0, code: "NETWORK" });
  });
});
