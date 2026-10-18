import { describe, expect, it } from "vitest";
import { decodeEmbeddedDestination, decodeKnownShortener } from "./decode.ts";

const b64 = (text: string) => Buffer.from(text).toString("base64");
const decode = (url: string) => decodeEmbeddedDestination(new URL(url))?.href ?? null;

describe("decodeEmbeddedDestination", () => {
  it("lê o destino em Base64 do Linkvertise dinâmico", () => {
    // Exemplo público: btoa(encodeURI("https://google.com"))
    expect(decode("https://link-to.net/65354/941.8708341041977/dynamic?r=aHR0cHM6Ly9nb29nbGUuY29t")).toBe(
      "https://google.com/",
    );
  });

  it("aceita Base64 com caracteres que a query string altera (+ vira espaço)", () => {
    const target = "https://exemplo.com/a?b=c>>>";
    const encoded = b64(target);
    expect(encoded).toContain("+");
    expect(decode(`https://link-to.net/1/2/dynamic?r=${encoded}`)).toBe(new URL(target).href);
  });

  it("aceita Base64 na variante URL-safe e sem padding", () => {
    const encoded = b64("https://exemplo.com/a?b=c>>>").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decode(`https://link-to.net/1/2/dynamic?r=${encoded}`)).toBe("https://exemplo.com/a?b=c%3E%3E%3E");
  });

  it("desfaz o encodeURI aplicado antes do Base64", () => {
    const encoded = b64(encodeURI("https://exemplo.com/página com espaço"));
    expect(decode(`https://link-to.net/1/2/dynamic?r=${encoded}`)).toBe("https://exemplo.com/p%C3%A1gina%20com%20espa%C3%A7o");
  });

  it("lê destino em texto puro em parâmetros comuns", () => {
    expect(decode("https://adf.ly/redirect?url=https%3A%2F%2Fexemplo.com%2Fx")).toBe("https://exemplo.com/x");
    expect(decode("https://ouo.io/qs/abc?s=https://exemplo.com/y")).toBe("https://exemplo.com/y");
  });

  it("ignora o que não é um endereço http/https", () => {
    expect(decode(`https://link-to.net/1/2/dynamic?r=${b64("javascript:alert(1)")}`)).toBeNull();
    expect(decode("https://adf.ly/x?url=/login")).toBeNull();
    expect(decode("https://adf.ly/x?r=naoebase64!!")).toBeNull();
  });

  it("devolve null quando não há destino embutido", () => {
    expect(decode("https://linkvertise.com/514008/hydrogen-gateway-1")).toBeNull();
  });
});

describe("decodeKnownShortener", () => {
  const b64 = (text: string, times = 1) => {
    let out = text;
    for (let i = 0; i < times; i++) out = Buffer.from(out).toString("base64");
    return out;
  };
  const decode = (href: string) => decodeKnownShortener(new URL(href))?.href ?? null;

  it("decodifica base64 de um parâmetro", () => {
    expect(decode(`https://sfl.gl/abc?u=${b64("https://exemplo.com/a")}`)).toBe("https://exemplo.com/a");
    expect(decode(`https://www.ecryptly.com/go?id=${b64("https://exemplo.com/")}`)).toBe("https://exemplo.com/");
  });

  it("respeita o caminho exigido pela regra", () => {
    const payload = b64("https://exemplo.com/");
    expect(decode(`https://sharetext.me/redirect?url=${payload}`)).toBe("https://exemplo.com/");
    expect(decode(`https://sharetext.me/outra?url=${payload}`)).toBeNull();
  });

  it("decodifica várias camadas de base64 no fragmento", () => {
    expect(decode(`https://mh.gourlpro.com/#${b64("https://exemplo.com/x", 3)}`)).toBe("https://exemplo.com/x");
    expect(decode(`https://mh.gourlpro.com/#${b64("https://exemplo.com/x", 1)}`)).toBeNull();
  });

  it("ignora hosts fora da lista e lixo no lugar do base64", () => {
    expect(decode(`https://site.com/?u=${b64("https://exemplo.com/")}`)).toBeNull();
    expect(decode("https://sfl.gl/abc?u=nao-e-base64")).toBeNull();
    expect(decode(`https://sfl.gl/abc?u=${b64("javascript:alert(1)")}`)).toBeNull();
  });
});
