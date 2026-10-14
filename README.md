# Lumi Links — portal-app

Monorepo do projeto: frontend React e backend Spring Boot no mesmo repositório.

| Pasta | Stack | Docs |
| --- | --- | --- |
| [`frontend/`](frontend/README.md) | React 19 + Vite + Tailwind v4 + React Router 7, testes com Vitest | `frontend/README.md` |
| [`backend/`](backend/) | Spring Boot 4 + Java 21, PostgreSQL via JPA/Flyway, OAuth2 resource server | `backend/docs/` |
| [`tools-api/`](tools-api/) | Node 22 + Express: bypass de encurtadores e proxy do VirusTotal | `tools-api/.env.example` |

## Como rodar

```bash
# 1. variaveis de ambiente (gere o JWT_SECRET com: openssl rand -base64 32)
cp .env.example .env

# 2. Postgres local
docker compose up -d db

# 3. backend (API em :8080, actuator em :8081)
cd backend && ./mvnw spring-boot:run

# 4. frontend (http://localhost:5173)
cd frontend && npm install && npm run dev

# 5. tools-api (http://localhost:3001) — o Vite encaminha /tools/* para ele
cd tools-api && cp .env.example .env   # preencha VT_API_KEY
npm install && npm run dev
```

O backend le `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` e `PUBLIC_BASE_URL` do
ambiente, sem default para os segredos: se o `JWT_SECRET` faltar ou tiver menos de 256
bits, a app falha ao iniciar de proposito.

O `tools-api` expõe `POST /tools/unshorten` (segue os redirecionamentos no servidor, com proteção SSRF) e `POST /tools/scan` (proxy do VirusTotal; a chave fica só no servidor). Testes: `cd tools-api && npm test`.

## Gitflow

`main` (produção) ← `develop` (integração) ← `feature/*`. Hotfixes saem de `main`, releases de `develop`.
Os PNGs são versionados com Git LFS (`git lfs install` antes do primeiro clone/commit).
