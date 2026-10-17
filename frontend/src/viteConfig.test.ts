import { describe, expect, it } from "vitest";
import config from "../vite.config";

describe("proxy do Vite", () => {
  // Chave em string casa por prefixo: "/r" mandaria /rocket (um portal) para o backend.
  it("só desvia caminhos com a barra do prefixo, deixando /:code para a Travessia", () => {
    const keys = Object.keys(config.server?.proxy ?? {});
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(key).toMatch(/^\/[a-z]+\/$/);
    for (const code of ["/rocket", "/apiary", "/toolsbox"]) {
      expect(keys.some((key) => code.startsWith(key))).toBe(false);
    }
  });
});
