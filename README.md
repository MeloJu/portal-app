# Lumi Links — portal-app

Monorepo do projeto: frontend React e backend Spring Boot no mesmo repositório.

| Pasta | Stack | Docs |
| --- | --- | --- |
| [`frontend/`](frontend/README.md) | React 19 + Vite + Tailwind v4 + React Router 7, testes com Vitest | `frontend/README.md` |
| [`backend/`](backend/) | Spring Boot 4 + Java 21, PostgreSQL via JPA/Flyway, OAuth2 resource server | `backend/docs/`, [`docs/openapi.yaml`](docs/openapi.yaml) |
| [`tools-api/`](tools-api/) | Node 22 + Express: bypass de encurtadores e proxy do VirusTotal | `tools-api/.env.example` |
| [`extension/`](extension/) | Extensão Chrome/Edge (MV3): leva o link revelado no bypass.city para a Lumi | `extension/README.md` |

## Como rodar

Escolha uma rota abaixo para o backend:

### Opção A: Docker (rápido, sem dependências locais)

```bash
./scripts/dev-backend-docker.sh    # Windows sem Git Bash: .\scripts\dev-backend-docker.ps1
```

Não precisa de Java instalado — a imagem traz tudo. Leva uns segundos na primeira vez (build).

### Opção B: Local com Java 21 (mais rápido para dev iterativo)

Requer [Java 21 instalado](https://www.oracle.com/java/technologies/downloads/#java21).

```bash
./scripts/dev-backend.sh           # Windows sem Git Bash: .\scripts\dev-backend.ps1
```

### Frontend e ferramentas (ambas as opções)

```bash
# Frontend (http://localhost:5173)
cd frontend && npm install && npm run dev

# Tools API (http://localhost:3001)
cd tools-api && cp .env.example .env   # preencha VT_API_KEY
npm install && npm run dev
```

### Por que dois scripts?

O Spring Boot **não lê o arquivo `.env`** — quem lê é o `docker compose`. Rodando `cd backend && ./mvnw spring-boot:run` 
direto depois de `cp .env.example .env`, o `${DB_URL}` resolve para vazio e falha com `'url' must start with "jdbc"`. 

Os scripts cuidam de tudo:
- Criam o `.env` se faltar
- Geram um `JWT_SECRET` se estiver vazio
- Carregam as variáveis no ambiente do processo
- Sobem o Postgres (com healthcheck)
- Iniciam a API

Aí funciona em qualquer terminal ou IDE (aponte a run config para um dos scripts).

## Imagem do backend

O CI publica em `ghcr.io/meloju/portal-app/backend` a cada push em `main` ou `develop`
(workflow `publish-backend.yml`); em PR a imagem só é construída, para quebrar o PR se o
Dockerfile parar de funcionar. As tags são o nome da branch, `sha-<commit>` e `latest`
(só em `main`).

Para rodar a imagem localmente, apontando para o Postgres do compose:

```bash
cd backend && docker build -t l2-api:dev .

docker run --rm -p 8080:8080 -p 8081:8081 \
  --read-only --tmpfs /tmp \
  -e DB_URL=jdbc:postgresql://host.docker.internal:5432/lumi \
  -e DB_USER=lumi -e DB_PASSWORD=lumi \
  -e PUBLIC_BASE_URL=http://localhost:8080 \
  -e JWT_SECRET="$(openssl rand -base64 32)" \
  l2-api:dev

curl localhost:8081/actuator/health   # {"status":"UP"}
```

Roda como `USER 1001` e com a raiz somente leitura, igual ao Deployment
(`backend/docs/SECURITY.md`, seção 10) — daí o `--tmpfs /tmp`, que é onde a JVM e o Tomcat
escrevem. O agente OTel vem anexado mas desligado (`OTEL_SDK_DISABLED=true`): para ligar,
passe `OTEL_SDK_DISABLED=false` e `OTEL_EXPORTER_OTLP_ENDPOINT`.

O `tools-api` expõe `POST /tools/unshorten` (segue os redirecionamentos no servidor, com proteção SSRF; em links com anúncio lê o destino do endereço ou da página, opcionalmente abre a página num navegador headless (`BROWSER_RESOLVER=on`) e, com `BYPASS_API_URL` configurado (a chave é opcional), pergunta a um serviço de bypass, creditado na tela; nunca resolve captcha nem acessa endereços de verificação de etapa) e `POST /tools/scan` (proxy do VirusTotal; a chave fica só no servidor). Testes: `cd tools-api && npm test`.

## Testando a API

O contrato fica em [`docs/openapi.yaml`](docs/openapi.yaml) e abre direto no Swagger UI da
app em `http://localhost:8080/swagger-ui.html`, onde o navegador guarda o cookie de sessao
sozinho. Para Postman, o workspace versionado esta em `postman/` (importe o diretorio ou o
proprio `docs/openapi.yaml`).

A sessao viaja em cookie `HttpOnly`, que Postman e curl so enviam por HTTPS. Para testar em
`http://localhost`, ponha `SESSION_COOKIE_SECURE=false` no `.env` -- nunca em producao.

## Gitflow

`main` (produção) ← `develop` (integração) ← `feature/*`. Hotfixes saem de `main`, releases de `develop`.
Os PNGs são versionados com Git LFS (`git lfs install` antes do primeiro clone/commit).
