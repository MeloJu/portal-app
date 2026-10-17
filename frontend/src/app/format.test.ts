import { describe, expect, it } from "vitest";
import { formatNumber, formatPct, relativeTime, shortLabel } from "./format";

describe("format", () => {
  it("formatNumber usa o separador de milhar pt-BR", () => {
    expect(formatNumber(8429)).toBe("8.429");
    expect(formatNumber(1234567)).toBe("1.234.567");
    expect(formatNumber(0)).toBe("0");
  });

  it("formatPct mostra sinal e uma casa decimal", () => {
    expect(formatPct(18.4)).toBe("+18,4%");
    expect(formatPct(-20)).toBe("-20,0%");
    expect(formatPct(0)).toBe("0,0%");
  });

  it("formatPct sem percentual vira travessão", () => {
    expect(formatPct(null)).toBe("—");
  });

  it("shortLabel tira o esquema do link curto", () => {
    expect(shortLabel("http://localhost:8080/abc")).toBe("localhost:8080/abc");
    expect(shortLabel("https://l2.to/aB3x9Q")).toBe("l2.to/aB3x9Q");
    expect(shortLabel("https://l2.to/")).toBe("l2.to");
  });

  it("shortLabel devolve o texto como veio quando não é URL", () => {
    expect(shortLabel("abc")).toBe("abc");
  });

  describe("relativeTime", () => {
    const now = new Date("2026-10-17T12:00:00Z");
    const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
    const MIN = 60_000;

    it.each([
      [ago(30_000), "Agora"],
      [ago(12 * MIN), "Há 12 min"],
      [ago(59 * MIN), "Há 59 min"],
      [ago(3 * 60 * MIN), "Há 3 h"],
      [ago(24 * 60 * MIN), "Há 1 dia"],
      [ago(2 * 24 * 60 * MIN), "Há 2 dias"],
      [new Date(now.getTime() + 5 * MIN).toISOString(), "Agora"],
    ])("%s → %s", (iso, expected) => {
      expect(relativeTime(iso, now)).toBe(expected);
    });
  });
});
