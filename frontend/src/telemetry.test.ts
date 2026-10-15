import { trace } from "@opentelemetry/api";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initTelemetry, shutdownTelemetry } from "./telemetry";

function makeFetchMock() {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: 200 }));
}

describe("telemetry", () => {
  const realFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof makeFetchMock>;
  let exporter: InMemorySpanExporter;

  beforeEach(() => {
    // Instala o mock ANTES do init: a instrumentacao embrulha o fetch que existir na hora.
    fetchMock = makeFetchMock();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    exporter = new InMemorySpanExporter();
  });

  afterEach(async () => {
    await shutdownTelemetry();
    globalThis.fetch = realFetch;
  });

  it("nao faz nada quando desligado", () => {
    expect(initTelemetry({ enabled: false })).toBeUndefined();
    expect(trace.getTracer("t").startSpan("s").isRecording()).toBe(false);
  });

  it("registra um provider real quando ligado", () => {
    expect(initTelemetry({ enabled: true, exporter })).toBeDefined();
    const span = trace.getTracer("t").startSpan("s");
    expect(span.isRecording()).toBe(true);
    span.end();
  });

  it("e idempotente: chamar duas vezes devolve o mesmo provider", () => {
    const first = initTelemetry({ enabled: true, exporter });
    expect(initTelemetry({ enabled: true, exporter })).toBe(first);
  });

  it("propaga traceparent nas chamadas fetch para a API", async () => {
    initTelemetry({ enabled: true, exporter });

    await fetch("/api/links");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get("traceparent")).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/);
  });

  // O FetchInstrumentation so encerra o span depois que o resource timing do navegador chega
  // (assincrono), entao e preciso esperar o span aparecer em vez de dar flush uma vez so.
  async function exportedSpans(provider: ReturnType<typeof initTelemetry>, expected: number) {
    await vi.waitFor(
      async () => {
        await provider?.forceFlush();
        expect(exporter.getFinishedSpans()).toHaveLength(expected);
      },
      { timeout: 3000, interval: 100 },
    );
    return exporter.getFinishedSpans();
  }

  it("cada fetch vira um span exportado", async () => {
    const provider = initTelemetry({ enabled: true, exporter });

    await fetch("/api/links");

    const spans = await exportedSpans(provider, 1);
    expect(spans[0]?.name).toMatch(/GET/);
    expect(spans[0]?.attributes["url.full"] ?? spans[0]?.attributes["http.url"]).toContain("/api/links");
  });

  it("nao gera span para o envio dos proprios spans", async () => {
    const provider = initTelemetry({ enabled: true, exporter });

    await fetch("/api/links");
    await exportedSpans(provider, 1);

    await fetch("/v1/traces", { method: "POST", body: "{}" });
    // Tempo suficiente para um span, se houvesse, terminar e ser exportado.
    await new Promise((resolve) => setTimeout(resolve, 800));
    await provider?.forceFlush();

    expect(exporter.getFinishedSpans()).toHaveLength(1);
  });
});
