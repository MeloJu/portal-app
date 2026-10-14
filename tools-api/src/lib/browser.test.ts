import { describe, expect, it } from "vitest";
import { createBrowserResolver, isDestination } from "./browser.ts";

const gate = new URL("https://linkvertise.com/514008/abc");

describe("isDestination", () => {
  it("aceita navegação para fora do serviço de anúncio", () => {
    expect(isDestination(new URL("https://exemplo.com/arquivo.zip"), gate)).toBe(true);
  });

  it("ignora outras etapas do mesmo anúncio e de serviços parceiros", () => {
    expect(isDestination(new URL("https://linkvertise.com/514008/abc?o=sharing"), gate)).toBe(false);
    expect(isDestination(new URL("https://link-to.net/514008/abc"), gate)).toBe(false);
  });

  it("ignora esquemas que não são http/https", () => {
    expect(isDestination(new URL("javascript:alert(1)"), gate)).toBe(false);
  });
});

describe("createBrowserResolver", () => {
  it("fica desligado sem BROWSER_RESOLVER=on", () => {
    expect(createBrowserResolver()).toBeNull();
    expect(createBrowserResolver({ enabled: true })).toBeTypeOf("function");
  });
});
