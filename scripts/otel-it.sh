#!/usr/bin/env bash
# Teste de integracao do tracing: sobe Postgres + OTel Collector + o backend COM o agente
# OpenTelemetry (a imagem real, com as mesmas restricoes do Deployment) e confere que
#   - o backend fica pronto e expoe os buckets de latencia para o Prometheus;
#   - os spans chegam ao Collector, inclusive o do banco (JDBC);
#   - um traceparent vindo de fora (o do navegador) continua no mesmo trace;
#   - o spanmetrics gera as metricas RED que o dashboard usa;
#   - a senha enviada no cadastro nao aparece em nenhum trace (SECURITY.md secao 8).
# Demora alguns minutos (o backend precisa subir). Uso local; requer docker e curl.
#
#   docker build -t lumi-backend:test backend
#   scripts/otel-it.sh
set -euo pipefail

cd "$(dirname "$0")/.."

BACKEND_IMAGE="${BACKEND_IMAGE:-lumi-backend:test}"
COLLECTOR_IMAGE="${COLLECTOR_IMAGE:-otel/opentelemetry-collector-contrib:0.162.0}"
NET=lumi-it
API_PORT="${API_PORT:-18081}"
MGMT_PORT="${MGMT_PORT:-18082}"
SPANMETRICS_PORT="${SPANMETRICS_PORT:-18889}"
PASSWORD="senha-super-secreta-$RANDOM"

# No Git Bash (Windows) os argumentos do docker seriam reescritos como caminhos do Windows.
# A variavel vale so para o docker: no curl ela quebraria o /dev/null.
docker() { MSYS_NO_PATHCONV=1 command docker "$@"; }

HERE="$(pwd -W 2>/dev/null || pwd)"
failures=0
pass() { echo "  ok   $1"; }
fail() { echo "  FAIL $1"; failures=$((failures + 1)); }

cleanup() {
  docker rm -f lumi-it-db lumi-it-otel lumi-it-backend >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

docker network create "$NET" >/dev/null

echo "subindo Postgres, Collector e backend..."
docker run -d --name lumi-it-db --network "$NET" \
  -e POSTGRES_DB=lumi -e POSTGRES_USER=lumi -e POSTGRES_PASSWORD=lumi \
  postgres:18-alpine >/dev/null

docker run -d --name lumi-it-otel --network "$NET" \
  -v "$HERE/scripts/otel-it/collector.yaml:/etc/otelcol/config.yaml:ro" \
  -p "$SPANMETRICS_PORT:8889" \
  "$COLLECTOR_IMAGE" --config=/etc/otelcol/config.yaml >/dev/null

for _ in $(seq 1 30); do
  docker exec lumi-it-db pg_isready -U lumi -d lumi >/dev/null 2>&1 && break
  sleep 1
done

docker run -d --name lumi-it-backend --network "$NET" \
  --user 1001 --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges \
  -p "$API_PORT:8080" -p "$MGMT_PORT:8081" \
  -e DB_URL=jdbc:postgresql://lumi-it-db:5432/lumi -e DB_USER=lumi -e DB_PASSWORD=lumi \
  -e JWT_SECRET="$(openssl rand -base64 32)" \
  -e PUBLIC_BASE_URL=http://localhost -e SESSION_COOKIE_SECURE=false \
  -e JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -javaagent:/app/opentelemetry-javaagent.jar" \
  -e OTEL_SERVICE_NAME=lumi-backend \
  -e OTEL_EXPORTER_OTLP_ENDPOINT=http://lumi-it-otel:4318 \
  -e OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf \
  -e OTEL_METRICS_EXPORTER=none -e OTEL_LOGS_EXPORTER=none \
  -e OTEL_BSP_SCHEDULE_DELAY=1000 \
  "$BACKEND_IMAGE" >/dev/null

ready=0
for _ in $(seq 1 90); do
  if curl -sf "localhost:$MGMT_PORT/actuator/health/readiness" 2>/dev/null | grep -q '"UP"'; then ready=1; break; fi
  sleep 2
done
if [ "$ready" != 1 ]; then
  echo "backend nao ficou pronto em 3 min"; docker logs --tail 40 lumi-it-backend; exit 1
fi
pass "backend pronto (readiness UP) com o agente carregado"

API="localhost:$API_PORT"
JAR="$(mktemp)"

# Trafego: cadastro, login, sessao, uma rota inexistente e uma chamada com traceparent de fora.
curl -s -X POST "$API/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Teste\",\"email\":\"it@lumi.test\",\"password\":\"$PASSWORD\"}" >/dev/null
curl -s -c "$JAR" -X POST "$API/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"it@lumi.test\",\"password\":\"$PASSWORD\"}" >/dev/null
curl -s -b "$JAR" "$API/api/me" >/dev/null
curl -s "$API/api/links/nao-existe" >/dev/null || true
TRACE_ID="4bf92f3577b34da6a3ce929d0e0e4736"
curl -s -b "$JAR" -H "traceparent: 00-$TRACE_ID-00f067aa0ba902b7-01" "$API/api/me" >/dev/null
rm -f "$JAR"

# O agente exporta em lote (1s) e o spanmetrics descarrega a cada 5s (o padrao e 60s); da um tempo.
sleep 12
OTEL_LOG="$(docker logs lumi-it-otel 2>&1)"

echo "metricas do Actuator (porta 8081)"
if curl -s "localhost:$MGMT_PORT/actuator/prometheus" | grep -q '^http_server_requests_seconds_bucket'; then
  pass "http_server_requests_seconds_bucket publicado (p50/p95/p99 do dashboard)"
else
  fail "faltam os buckets de latencia em /actuator/prometheus"
fi

echo "traces no Collector"
if grep -q 'service.name: Str(lumi-backend)' <<<"$OTEL_LOG"; then pass "spans com service.name=lumi-backend"; else fail "nenhum span de lumi-backend"; fi
if grep -qE 'db\.system(\.name)?: Str\(postgresql\)' <<<"$OTEL_LOG"; then pass "span do banco (JDBC / PostgreSQL)"; else fail "nenhum span de banco"; fi
if grep -q "$TRACE_ID" <<<"$OTEL_LOG"; then pass "traceparent externo continuou no mesmo trace (navegador -> API)"; else fail "o trace $TRACE_ID nao apareceu no backend"; fi
if grep -q "$PASSWORD" <<<"$OTEL_LOG"; then fail "a senha apareceu em um trace"; else pass "senha do cadastro fora dos traces"; fi

echo "spanmetrics (metricas RED que o dashboard usa)"
SM="$(curl -s "localhost:$SPANMETRICS_PORT/metrics")"
if grep -q '^traces_span_metrics_calls_total' <<<"$SM"; then pass "traces_span_metrics_calls_total"; else fail "faltou traces_span_metrics_calls_total"; fi
if grep -q '^traces_span_metrics_duration_milliseconds_bucket' <<<"$SM"; then pass "traces_span_metrics_duration_milliseconds_bucket"; else fail "faltou traces_span_metrics_duration_milliseconds_bucket"; fi
if grep -q 'span_kind="SPAN_KIND_SERVER"' <<<"$SM"; then pass "label span_kind=SPAN_KIND_SERVER (usado no painel 'Spans por servico')"; else fail "label span_kind nao bate com o dashboard"; fi
if grep -q 'service_name="lumi-backend"' <<<"$SM"; then pass "label service_name=lumi-backend"; else fail "label service_name nao bate com o dashboard"; fi

if [ "$failures" -gt 0 ]; then
  echo "$failures verificacao(oes) falharam"
  exit 1
fi
echo "OK"
