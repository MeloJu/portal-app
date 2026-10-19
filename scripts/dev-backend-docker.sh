#!/usr/bin/env bash
set -euo pipefail

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

if [ ! -f .env ]; then
	echo "==> .env nao existe; criando a partir de .env.example"
	cp .env.example .env
fi

ensure_secret() {
	name=$1
	current_secret=$(sed -nE "s/^${name}=[[:space:]]*(.*)\$/\1/p" .env | tail -1 | tr -d '\r')

	if [ -z "$current_secret" ]; then
		echo "==> $name vazio; gerando um"
		secret=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -d '\n')
		tmp=$(mktemp)
		if grep -q "^${name}=" .env; then
			awk -v n="$name" -v s="$secret" 'index($0, n "=") == 1 { print n "=" s; next } { print }' .env >"$tmp"
		else
			cat .env >"$tmp"
			printf '%s=%s\n' "$name" "$secret" >>"$tmp"
		fi
		mv "$tmp" .env
	fi
}

ensure_secret JWT_SECRET
ensure_secret APP_CODE_PEPPER

tmp_env=$(mktemp)
tr -d '\r' <.env >"$tmp_env"
set -a
# shellcheck disable=SC1090
. "$tmp_env"
set +a
rm -f "$tmp_env"

echo "==> subindo o Postgres e esperando ficar saudavel"
docker compose up -d --wait db

echo "==> buildando a imagem do backend"
cd backend
docker build -t l2-api:dev .

echo "==> API em http://localhost:8080 (actuator em :8081)"
docker run --rm \
	-p 8080:8080 -p 8081:8081 \
	--network host \
	-e DB_URL="jdbc:postgresql://localhost:5432/lumi" \
	-e DB_USER="$DB_USER" \
	-e DB_PASSWORD="$DB_PASSWORD" \
	-e PUBLIC_BASE_URL="$PUBLIC_BASE_URL" \
	-e JWT_SECRET="$JWT_SECRET" \
	-e APP_CODE_PEPPER="$APP_CODE_PEPPER" \
	-e GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}" \
	-e GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}" \
	-e GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID:-}" \
	-e GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET:-}" \
	l2-api:dev
