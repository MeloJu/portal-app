# Lumi Links — portal-app

Monorepo do projeto: frontend React e backend Spring Boot no mesmo repositório.

| Pasta | Stack | Docs |
| --- | --- | --- |
| [`frontend/`](frontend/README.md) | React 19 + Vite + Tailwind v4 + React Router 7, testes com Vitest | `frontend/README.md` |
| [`backend/`](backend/) | Spring Boot 4 + Java 21, PostgreSQL via JPA/Flyway, OAuth2 resource server | `backend/docs/` |
| [`tools-api/`](tools-api/) | Node 22 + Express: bypass de encurtadores e proxy do VirusTotal | `tools-api/.env.example` |

## Como rodar

```bash
# frontend (http://localhost:5173)
cd frontend && npm install && npm run dev

# backend (http://localhost:8080)
cd backend && ./mvnw spring-boot:run

# tools-api (http://localhost:3001) — o Vite encaminha /tools/* para ele
cd tools-api && cp .env.example .env   # preencha VT_API_KEY
npm install && npm run dev
```

O `tools-api` expõe `POST /tools/unshorten` (segue os redirecionamentos no servidor, com proteção SSRF) e `POST /tools/scan` (proxy do VirusTotal; a chave fica só no servidor). Testes: `cd tools-api && npm test`.

## Gitflow

`main` (produção) ← `develop` (integração) ← `feature/*`. Hotfixes saem de `main`, releases de `develop`.
Os PNGs são versionados com Git LFS (`git lfs install` antes do primeiro clone/commit).
