import { afterEach, describe, expect, it, vi } from "vitest";
import { IGNORED_URLS, OTLP_TRACES_PATH, startTelemetry, telemetryEnabled } from "./telemetry";
import mainSource from "./main.tsx?raw";

afterEach(() => vi.unstubAllGlobals());

describe("telemetry", () => {
  it("liga no build de produção e desliga no dev", () => {
    expect(telemetryEnabled({ DEV: false })).toBe(true);
    expect(telemetryEnabled({ DEV: true })).toBe(false);
  });

  it("VITE_OTEL força ligado ou desligado", () => {
    expect(telemetryEnabled({ DEV: true, VITE_OTEL: "on" })).toBe(true);
    expect(telemetryEnabled({ DEV: false, VITE_OTEL: "off" })).toBe(false);
  });

  it("ignora a rota dos próprios spans, mas não a API", () => {
    const ignored = (url: string) => IGNORED_URLS.some((re) => re.test(url));
    expect(ignored(OTLP_TRACES_PATH)).toBe(true);
    expect(ignored("/api/links")).toBe(false);
    expect(ignored("/tools/scan")).toBe(false);
  });

  it("propaga o traceparent nas chamadas à API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    startTelemetry();

    await fetch("/api/me", { credentials: "same-origin" });

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    // W3C trace context: versão-traceId(32 hex)-spanId(16 hex)-flags
    expect(headers.get("traceparent")).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/);
  });

  // Regressão real: com a telemetria ligada no corpo do main.tsx, o primeiro /api/me (disparado pelo router na
  // importação do App) saía sem traceparent. A ordem dos imports é o que garante a cobertura.
  it("main.tsx importa a telemetria antes de qualquer outro módulo", () => {
    const firstImport = mainSource.split(/\r?\n/).find((line) => line.startsWith("import "));
    expect(firstImport).toBe('import "./telemetry-init";');
  });
});
