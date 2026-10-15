# Tracing e métricas

```
navegador ── fetch + traceparent ──► backend (agente OTel) ──► Collector ──► Tempo ──► Grafana
  SDK web                              JDBC, MVC, Tomcat          │
  /v1/traces ─────────────────────────────────────────────────────┤ spanmetrics
                                                                  ▼
backend :8081 /actuator/prometheus ──────────────────────► Prometheus ──► Grafana
```

Os manifests do Collector, Tempo, Prometheus, Grafana e o dashboard ficam no
[portal-gitops](https://github.com/MeloJu/portal-gitops) (`observability/`).

## Backend

- O agente OpenTelemetry vem na imagem (`backend/Dockerfile`, versão e SHA-256 fixados) e só é
  carregado quando o Deployment define `-javaagent:/app/opentelemetry-javaagent.jar` em
  `JAVA_TOOL_OPTIONS`. Sem isso, a imagem roda sem tracing.
- As métricas continuam com Micrometer. `application.yml` publica os buckets de
  `http_server_requests_seconds` para o dashboard calcular p50/p95/p99.
- O agente não captura o header `Authorization` por padrão. Não adicione headers a uma allowlist
  "para depurar" (`backend/docs/SECURITY.md`, seção 8).

## Frontend

`frontend/src/telemetry.ts` liga o SDK web em build de produção. Cada `fetch` vira um span e leva
`traceparent`, então o trace começa no navegador. Os spans saem por OTLP/HTTP para `/v1/traces`, na
mesma origem (sem CORS). Para desligar em um build: `VITE_OTEL_DISABLED=true`.

## Testes

| O quê | Onde | Como rodar |
| --- | --- | --- |
| Chaves de observabilidade do `application.yml` | `ObservabilityConfigTests` | `cd backend && ./mvnw -Dtest=ObservabilityConfigTests test` |
| SDK web: init, `traceparent`, span por `fetch` | `frontend/src/telemetry.test.ts` | `cd frontend && npm test` |
| Backend real + agente + Collector | `scripts/otel-it.sh` (job `tracing` do `ci.yml`) | `docker build -t lumi-backend:test backend && scripts/otel-it.sh` |

`otel-it.sh` confere readiness, buckets de latência, spans com `service.name`, span de banco
(JDBC), continuação de um `traceparent` externo, ausência de senha nos traces e as métricas
`traces_span_metrics_*` que o dashboard consulta.
