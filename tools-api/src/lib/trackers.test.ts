import { describe, expect, it } from "vitest";
import { findTrackers, stripTrackers } from "./trackers.ts";

const u = (href: string) => new URL(href);

describe("findTrackers", () => {
  it("acha parâmetros de campanha, anúncio e rede social no destino", () => {
    const final = u("https://loja.com/produto?id=7&utm_source=news&utm_medium=email&fbclid=abc&gclid=x");
    const found = findTrackers([final], final);
    expect(found.map((t) => [t.name, t.category, t.inFinal])).toEqual([
      ["utm_source", "analytics", true],
      ["utm_medium", "analytics", true],
      ["fbclid", "social", true],
      ["gclid", "ads", true],
    ]);
  });

  it("não marca parâmetros comuns nem ambíguos", () => {
    const final = u("https://site.com/?id=1&ref=amigo&page=2&q=utm");
    expect(findTrackers([final], final)).toEqual([]);
  });

  it("marca parâmetro só da origem como fora do destino e junta repetidos", () => {
    const start = u("https://bit.ly/abc?utm_source=zap");
    const final = u("https://loja.com/?utm_source=zap&utm_campaign=x");
    const found = findTrackers([start, final], final);
    expect(found.find((t) => t.name === "utm_source")?.inFinal).toBe(true);
    expect(found).toHaveLength(2);
    const onlyStart = findTrackers([start, u("https://loja.com/")], u("https://loja.com/"));
    expect(onlyStart[0]).toMatchObject({ name: "utm_source", inFinal: false });
  });

  it("acha domínios de rastreamento na rota", () => {
    const route = [u("https://l.facebook.com/l.php?u=x"), u("https://u123.ct.sendgrid.net/ls/click"), u("https://loja.com/")];
    const found = findTrackers(route, route[2]);
    expect(found.map((t) => [t.name, t.kind, t.category])).toEqual([
      ["l.facebook.com", "domain", "social"],
      ["sendgrid.net", "domain", "email"],
    ]);
  });

  it("só trata 'si' como rastreador em YouTube e Spotify", () => {
    const yt = u("https://youtu.be/abc?si=xyz");
    expect(findTrackers([yt], yt).map((t) => t.name)).toEqual(["si"]);
    const other = u("https://site.com/?si=1");
    expect(findTrackers([other], other)).toEqual([]);
  });

  it("não confunde domínios parecidos", () => {
    const fake = u("https://notdoubleclick.net.exemplo.com/");
    expect(findTrackers([fake], fake)).toEqual([]);
  });
});

describe("stripTrackers", () => {
  it("remove só os rastreadores e preserva o resto da query e o fragmento", () => {
    expect(stripTrackers(u("https://loja.com/p?id=7&utm_source=a&cor=azul%20claro&fbclid=z#topo"))).toBe(
      "https://loja.com/p?id=7&cor=azul%20claro#topo",
    );
  });

  it("tira a interrogação quando não sobra nada", () => {
    expect(stripTrackers(u("https://loja.com/p?utm_source=a&gclid=b"))).toBe("https://loja.com/p");
  });

  it("devolve o mesmo endereço quando não há rastreador", () => {
    expect(stripTrackers(u("https://loja.com/p?a=1&b=2"))).toBe("https://loja.com/p?a=1&b=2");
  });
});
