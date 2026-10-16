#!/usr/bin/env bash
set -euo pipefail

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

if [ ! -f .env ]; then
	echo "==> .env nao existe; criando a partir de .env.example"
	cp .env.example .env
fi

current_secret=$(sed -nE 's/^JWT_SECRET=[[:space:]]*(.*)$/\1/p' .env | tail -1 | tr -d '\r')

if [ -z "$current_secret" ]; then
	echo "==> JWT_SECRET vazio; gerando um"
	secret=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -d '\n')
	tmp=$(mktemp)
	if grep -q '^JWT_SECRET=' .env; then
		awk -v s="$secret" '/^JWT_SECRET=/ { print "JWT_SECRET=" s; next } { print }' .env >"$tmp"
	else
		cat .env >"$tmp"
		printf 'JWT_SECRET=%s\n' "$secret" >>"$tmp"
	fi
	mv "$tmp" .env
fi

tmp_env=$(mktemp)
tr -d '\r' <.env >"$tmp_env"
set -a
# shellcheck disable=SC1090
. "$tmp_env"
set +a
rm -f "$tmp_env"

echo "==> subindo o Postgres e esperando ficar saudavel"
docker compose up -d --wait db

echo "==> API em http://localhost:8080 (actuator em :8081)"
cd backend
exec ./mvnw spring-boot:run "$@"
