/**
 * OpenTelemetry no browser: cada `fetch` vira um span e leva o cabeçalho `traceparent` para a API, então o
 * trace começa no navegador e atravessa Traefik → l2-api → Postgres.
 *
 * Os spans vão para `/otlp/v1/traces` na mesma origem do app (sem CORS). No cluster essa rota é pública e
 * protegida (limite de taxa e de tamanho), e o Collector força `service.name=l2-frontend` em tudo que chega
 * por ela: o valor declarado aqui é só o padrão.
 */

import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

export const OTLP_TRACES_PATH = "/otlp/v1/traces";

/** O envio dos próprios spans não vira span (senão cada exportação geraria outra, em loop). */
export const IGNORED_URLS = [/\/otlp\//];

/**
 * Liga por padrão no build de produção (o que roda no cluster). No `npm run dev` fica desligado porque o Vite
 * não tem a rota `/otlp`. `VITE_OTEL=on|off` força qualquer um dos dois.
 */
export function telemetryEnabled(env: { DEV: boolean; VITE_OTEL?: string }): boolean {
  if (env.VITE_OTEL === "off") return false;
  if (env.VITE_OTEL === "on") return true;
  return !env.DEV;
}

/** Telemetria nunca derruba o app: qualquer falha aqui só desliga os traces. */
export function startTelemetry(): void {
  try {
    const exporter = new OTLPTraceExporter({ url: new URL(OTLP_TRACES_PATH, window.location.origin).toString() });
    const provider = new WebTracerProvider({
      resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: "l2-frontend" }),
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });
    provider.register();
    registerInstrumentations({ instrumentations: [new FetchInstrumentation({ ignoreUrls: IGNORED_URLS })] });
  } catch (err) {
    console.warn("Telemetria desligada:", err);
  }
}
