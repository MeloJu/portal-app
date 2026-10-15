import { context, propagation, trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor, WebTracerProvider, type SpanExporter } from "@opentelemetry/sdk-trace-web";

/**
 * Tracing no navegador: cada `fetch` da app vira um span e leva o header `traceparent`, entao
 * o trace continua no backend (agente OTel) e chega ate o banco. Os spans saem por OTLP/HTTP
 * para o mesmo host (Ingress → OTel Collector), sem CORS (docs/SECURITY.md, secao 12).
 *
 * Fica desligado no `vite dev`, onde nao ha Collector. Nao captura corpo de requisicao nem
 * resposta, so metodo, URL e status (secao 8: nada sensivel em trace).
 */
export const OTLP_TRACES_PATH = "/v1/traces";
export const SERVICE_NAME = "lumi-frontend";

export interface TelemetryOptions {
  enabled?: boolean;
  endpoint?: string;
  /** Troca o exportador OTLP (usado nos testes, que nao fazem rede). */
  exporter?: SpanExporter;
}

function endsWith(path: string): RegExp {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}$`);
}

let provider: WebTracerProvider | undefined;
let unregisterInstrumentations: (() => void) | undefined;

export function initTelemetry({
  enabled = import.meta.env.PROD && import.meta.env.VITE_OTEL_DISABLED !== "true",
  endpoint = OTLP_TRACES_PATH,
  exporter = new OTLPTraceExporter({ url: endpoint }),
}: TelemetryOptions = {}): WebTracerProvider | undefined {
  if (!enabled) return undefined;
  if (provider) return provider;

  provider = new WebTracerProvider({
    resource: resourceFromAttributes({ "service.name": SERVICE_NAME }),
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });
  provider.register();

  unregisterInstrumentations = registerInstrumentations({
    instrumentations: [
      // Sem isto o envio dos proprios spans geraria spans, em loop. A instrumentacao compara a
      // URL absoluta (https://host/v1/traces), por isso a regex ancorada no fim.
      new FetchInstrumentation({ ignoreUrls: [endsWith(endpoint)] }),
    ],
  });
  return provider;
}

export async function shutdownTelemetry(): Promise<void> {
  unregisterInstrumentations?.();
  unregisterInstrumentations = undefined;
  await provider?.shutdown();
  provider = undefined;
  trace.disable();
  propagation.disable();
  context.disable();
}
