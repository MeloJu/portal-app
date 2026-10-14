import { afterEach, describe, expect, it, vi } from "vitest";
import { scan, ToolsError, unshorten } from "./tools";

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe("api/tools", () => {
  it("unshorten envia a URL por POST e devolve o resultado", async () => {
    const data = { originalUrl: "https://bit.ly/a", finalUrl: "https://x.com/", hops: [], resolvedBy: "redirect" };
    const fetchMock = vi.fn().mockResolvedValue(reply(200, data));
    vi.stubGlobal("fetch", fetchMock);

    await expect(unshorten("bit.ly/a")).resolves.toEqual(data);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/tools/unshorten");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ url: "bit.ly/a" });
  });

  it("converte erro da API em ToolsError com code e mensagem", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(422, { code: "REDIRECT_LOOP", message: "O link redireciona em círculo." })));
    const err = (await unshorten("a.com").catch((e) => e)) as ToolsError;
    expect(err).toBeInstanceOf(ToolsError);
    expect(err.code).toBe("REDIRECT_LOOP");
    expect(err.status).toBe(422);
    expect(err.message).toBe("O link redireciona em círculo.");
  });

  it("trata 202 como análise pendente (não como sucesso)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(202, { code: "ANALYSIS_PENDING", message: "em andamento" })));
    const err = (await scan("a.com").catch((e) => e)) as ToolsError;
    expect(err.isPending).toBe(true);
  });

  it("converte falha de rede em ToolsError NETWORK", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const err = (await unshorten("a.com").catch((e) => e)) as ToolsError;
    expect(err.code).toBe("NETWORK");
  });

  it("tolera resposta de erro sem JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>502</html>", { status: 502 })));
    const err = (await unshorten("a.com").catch((e) => e)) as ToolsError;
    expect(err.status).toBe(502);
    expect(err.code).toBe("UNKNOWN");
  });
});
