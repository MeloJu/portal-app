# Lumi Links — portal-app

Monorepo do projeto: frontend React e backend Spring Boot no mesmo repositório.

| Pasta | Stack | Docs |
| --- | --- | --- |
| [`frontend/`](frontend/README.md) | React 19 + Vite + Tailwind v4 + React Router 7, testes com Vitest | `frontend/README.md` |
| [`backend/`](backend/) | Spring Boot 4 + Java 21, PostgreSQL via JPA/Flyway, OAuth2 resource server | `backend/docs/`, [`docs/openapi.yaml`](docs/openapi.yaml) |
| [`tools-api/`](tools-api/) | Node 22 + Express: bypass de encurtadores e proxy do VirusTotal | `tools-api/.env.example` |
| [`extension/`](extension/) | Extensão Chrome/Edge (MV3): leva o link revelado no bypass.city para a Lumi | `extension/README.md` |

## Como rodar

```bash
# 1. backend: Postgres + API em :8080 (actuator em :8081)
./scripts/dev-backend.sh          # Windows sem Git Bash: .\scripts\dev-backend.ps1

# 2. frontend (http://localhost:5173)
cd frontend && npm install && npm run dev

# 3. tools-api (http://localhost:3001) — o Vite encaminha /tools/* para ele
cd tools-api && cp .env.example .env   # preencha VT_API_KEY
npm install && npm run dev
```

O `dev-backend` cria o `.env` a partir do `.env.example` se faltar, gera um `JWT_SECRET`
se estiver vazio, sobe o Postgres do compose (esperando o healthcheck) e so entao chama o
`mvnw`. Argumentos extras vao direto para o Maven:
`./scripts/dev-backend.sh -Dspring-boot.run.profiles=...`.

### Por que o script, e nao `cd backend && ./mvnw spring-boot:run`

O backend le `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` e `PUBLIC_BASE_URL` do
**ambiente do processo**, sem default para os segredos: se o `JWT_SECRET` faltar ou tiver
menos de 256 bits, a app falha ao iniciar de proposito.

E o Spring Boot **nao le o arquivo `.env`** -- quem le o `.env` sozinho e o
`docker compose`. Entao `cp .env.example .env` deixa o banco de pe mas nao exporta nada
para o `mvnw`: o `${DB_URL}` resolve para vazio e o Hikari para com
`'url' must start with "jdbc"`. Rodar pela IDE so funciona se a run config tiver as
variaveis, e run config nao e versionada -- o que funciona numa maquina nao funciona na
outra. O script carrega o `.env` no ambiente antes de subir a app, e e o mesmo caminho em
qualquer terminal ou IDE (aponte a run config para ele).

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
