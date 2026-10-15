#!/usr/bin/env bash
# Smoke test das imagens, rodando com as mesmas restricoes do Deployment (usuario 1001,
# filesystem somente leitura, sem capabilities). Uso local e no CI.
#
#   docker build -t lumi-frontend:test frontend
#   docker build -t lumi-tools-api:test tools-api
#   docker build -t lumi-backend:test backend
#   scripts/smoke-images.sh
set -euo pipefail

FRONTEND_IMAGE="${FRONTEND_IMAGE:-lumi-frontend:test}"
TOOLS_IMAGE="${TOOLS_IMAGE:-lumi-tools-api:test}"
BACKEND_IMAGE="${BACKEND_IMAGE:-lumi-backend:test}"
FE_PORT="${FE_PORT:-18080}"
TOOLS_PORT="${TOOLS_PORT:-13001}"

# No Git Bash (Windows) os argumentos do docker, como "--tmpfs /tmp", seriam reescritos como
# caminhos do Windows. A variavel vale so para o docker: no curl ela quebraria o /dev/null.
docker() { MSYS_NO_PATHCONV=1 command docker "$@"; }

RESTRICT=(--user 1001 --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges)
failures=0

cleanup() { docker rm -f smoke-fe smoke-tools >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

pass() { echo "  ok   $1"; }
fail() { echo "  FAIL $1"; failures=$((failures + 1)); }

# expect_header <descricao> <url> <regex>
expect_header() {
  if curl -sI "$2" | grep -qiE "$3"; then pass "$1"; else fail "$1 (esperava /$3/ em $2)"; fi
}
# reject_header <descricao> <url> <regex>
reject_header() {
  if curl -sI "$2" | grep -qiE "$3"; then fail "$1 (nao esperava /$3/ em $2)"; else pass "$1"; fi
}
# expect_status <descricao> <url> <codigo>
expect_status() {
  local got
  got="$(curl -s -w '\n%{http_code}' "$2" | tail -n 1)"
  if [ "$got" = "$3" ]; then pass "$1"; else fail "$1 (esperava $3, veio $got)"; fi
}
wait_for() {
  for _ in $(seq 1 30); do
    curl -sf "$1" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

echo "frontend ($FRONTEND_IMAGE)"
docker run -d --name smoke-fe "${RESTRICT[@]}" -p "$FE_PORT:8080" "$FRONTEND_IMAGE" >/dev/null
wait_for "localhost:$FE_PORT/" || { echo "frontend nao subiu"; docker logs smoke-fe; exit 1; }
FE="localhost:$FE_PORT"

expect_status "GET / responde 200" "$FE/" 200
expect_status "rota do React Router cai no index.html" "$FE/dashboard" 200
expect_header "CSP na home" "$FE/" "content-security-policy:.*default-src 'self'"
expect_header "CSP na Travessia" "$FE/r/abc" "content-security-policy:.*default-src 'self'"
expect_header "nosniff na home" "$FE/" "x-content-type-options: nosniff"
expect_header "nosniff na Travessia" "$FE/r/abc" "x-content-type-options: nosniff"
expect_header "Travessia envia Referrer-Policy no-referrer" "$FE/r/abc" "referrer-policy: no-referrer"
reject_header "home nao usa no-referrer" "$FE/" "referrer-policy: no-referrer"
expect_header "Travessia nao fica em cache" "$FE/r/abc" "cache-control: no-store"
expect_header "index.html nao fica em cache" "$FE/" "cache-control: no-cache"
asset="$(curl -s "$FE/" | grep -oE '/assets/[^"]+\.js' | head -1)"
if [ -n "$asset" ]; then
  expect_header "asset com hash fica em cache longo" "$FE$asset" "cache-control:.*immutable"
else
  fail "nao achei nenhum /assets/*.js no index.html"
fi
uid="$(docker exec smoke-fe id -u)"
if [ "$uid" = "1001" ]; then pass "frontend roda como uid 1001"; else fail "frontend roda como uid $uid"; fi

echo "tools-api ($TOOLS_IMAGE)"
docker run -d --name smoke-tools "${RESTRICT[@]}" -p "$TOOLS_PORT:3001" "$TOOLS_IMAGE" >/dev/null
wait_for "localhost:$TOOLS_PORT/tools/health" || { echo "tools-api nao subiu"; docker logs smoke-tools; exit 1; }
if curl -s "localhost:$TOOLS_PORT/tools/health" | grep -q '"status":"ok"'; then
  pass "GET /tools/health responde ok"
else
  fail "GET /tools/health nao respondeu ok"
fi
uid="$(docker exec smoke-tools id -u)"
if [ "$uid" = "1001" ]; then pass "tools-api roda como uid 1001"; else fail "tools-api roda como uid $uid"; fi

# O backend precisa de Postgres para subir, entao so confere o usuario da imagem.
if docker image inspect "$BACKEND_IMAGE" >/dev/null 2>&1; then
  echo "backend ($BACKEND_IMAGE)"
  uid="$(docker run --rm --entrypoint id "$BACKEND_IMAGE" -u)"
  if [ "$uid" = "1001" ]; then pass "backend roda como uid 1001"; else fail "backend roda como uid $uid"; fi
fi

if [ "$failures" -gt 0 ]; then
  echo "$failures verificacao(oes) falharam"
  exit 1
fi
echo "OK"
