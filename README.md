# Lumi Links: portal-app

Monorepo do projeto: frontend React e backend Spring Boot no mesmo repositório.

| Pasta | Stack | Docs |
| --- | --- | --- |
| [`frontend/`](frontend/README.md) | React 19 + Vite + Tailwind v4 + React Router 7, testes com Vitest | `frontend/README.md` |
| [`backend/`](backend/) | Spring Boot 4 + Java 21, PostgreSQL via JPA/Flyway, OAuth2 Resource Server | `backend/docs/`, [`docs/openapi.yaml`](docs/openapi.yaml) |
| [`tools-api/`](tools-api/) | Node 22 + Express: bypass de encurtadores e proxy do VirusTotal | `tools-api/.env.example` |
| [`extension/`](extension/) | Extensão Chrome/Edge (MV3): leva o link revelado no bypass.city para a Lumi | `extension/README.md` |

## Como rodar

Escolha uma das opções abaixo para executar o backend.

### Opção A: Docker (sem dependências locais)

Não precisa de Java instalado. A imagem contém o ambiente necessário. A primeira execução pode demorar alguns segundos devido ao build.

```bash
./scripts/dev-backend-docker.sh
```

No Windows sem Git Bash, use o PowerShell:

```powershell
.\scripts\dev-backend-docker.ps1
```

### Opção B: Java 21 local (mais rápido para desenvolvimento iterativo)

Requer [Java 21 instalado](https://www.oracle.com/java/technologies/downloads/#java21).

```bash
./scripts/dev-backend.sh
```

No Windows sem Git Bash, use o PowerShell:

```powershell
.\scripts\dev-backend.ps1
```

### Frontend e ferramentas

Execute cada serviço em um terminal separado.

**Frontend** (http://localhost:5173):

```bash
cd frontend
npm install
npm run dev
```

**Tools API** (http://localhost:3001):

```bash
cd tools-api
cp .env.example .env
```

Preencha `VT_API_KEY` no arquivo `.env` e execute:

```bash
npm install
npm run dev
```

No Windows, se `cp` não estiver disponível no terminal, copie `.env.example` para `.env` manualmente.

O Vite encaminha as requisições `/tools/*` para a Tools API.

## Configuração do backend

### Por que usar os scripts de desenvolvimento?

O Spring Boot não carrega automaticamente as variáveis de um arquivo `.env`. Quem interpreta esse arquivo é o Docker Compose.

Ao executar diretamente:

```bash
cd backend
./mvnw spring-boot:run
```

as variáveis definidas apenas no `.env` não estarão necessariamente disponíveis para o processo Java. Isso pode fazer com que `DB_URL` fique vazio e provoque um erro semelhante a:

```text
'url' must start with "jdbc"
```

Os scripts centralizam a configuração do ambiente. Eles devem:

- Criar o `.env` a partir do `.env.example`, caso não exista.
- Gerar um `JWT_SECRET` se estiver vazio.
- Carregar as variáveis no ambiente do processo.
- Subir o PostgreSQL pelo Docker Compose.
- Aguardar o healthcheck do banco.
- Iniciar o backend pelo Maven Wrapper.

O backend exige que `JWT_SECRET` tenha pelo menos 256 bits. Se o segredo estiver ausente ou for inválido, a aplicação deve falhar na inicialização.

Para executar pela IDE, configure as variáveis de ambiente necessárias ou utilize o script de desenvolvimento correspondente.

Os scripts também podem encaminhar argumentos adicionais ao Maven, desde que implementem esse repasse. Por exemplo:

```bash
./scripts/dev-backend.sh -Dspring-boot.run.profiles=...
```

## Imagens Docker e deploy

O workflow `images.yml` constrói as três imagens, escaneia com o Trivy (CRITICAL com correção disponível barra) e publica no GHCR:

- `ghcr.io/meloju/portal-app-backend`
- `ghcr.io/meloju/portal-app-frontend`
- `ghcr.io/meloju/portal-app-tools-api`

Em pull requests as imagens só são construídas e escaneadas, sem publicação.

As tags são `sha-<7 primeiros caracteres do commit>` (imutável, é a que vai para o cluster) e o nome da branch.

**Ordem:** o `ci.yml` chama o `images.yml` só depois de **todos** os testes passarem, então nada com teste vermelho é publicado.

**Deploy (GitOps):** depois de publicar as três imagens de um push em `develop`, o workflow abre um PR em [`portal-gitops`](https://github.com/MeloJu/portal-gitops) trocando a tag em `apps/l2/overlays/local/kustomization.yaml`, com **auto-merge**: ele entra sozinho quando os checks de lá passam, e o ArgoCD atualiza o cluster. Nenhum job daqui fala com o cluster, e nada pula a proteção de branch do `portal-gitops`. O PR é aberto com o secret `GITOPS_TOKEN`, um token fine-grained com acesso só àquele repositório.

### Acompanhar um deploy

Depois de um merge na `develop`:

1. **Actions → CI**: os testes rodam primeiro; o job `images` só começa se todos passarem.
2. **GHCR**: as três imagens aparecem com a tag `sha-<7 primeiros caracteres do commit>`.
3. **portal-gitops**: o workflow abre o PR `chore(release): portal-app sha-…` com auto-merge; ele entra quando os checks de lá passam.
4. **ArgoCD** troca as imagens do overlay `local`. No cluster local:

```bash
kubectl -n argocd get applications            # l2-local: Synced / Healthy
kubectl -n l2 get deploy -o wide              # a coluna IMAGES mostra a tag nova
```

Se o PR de bump não aparecer, o erro costuma estar no secret `GITOPS_TOKEN`: ele precisa de *Contents* e *Pull requests* em *Read and write* **só** no `portal-gitops`.

### Construir e executar localmente

```bash
cd backend
docker build -t l2-api:dev .
```

Execute a imagem apontando para o PostgreSQL do Docker Compose:

```bash
docker run --rm \
  -p 8080:8080 \
  -p 8081:8081 \
  --read-only \
  --tmpfs /tmp \
  -e DB_URL=jdbc:postgresql://host.docker.internal:5432/lumi \
  -e DB_USER=lumi \
  -e DB_PASSWORD=lumi \
  -e PUBLIC_BASE_URL=http://localhost:8080 \
  -e JWT_SECRET="$(openssl rand -base64 32)" \
  l2-api:dev
```

A API principal estará disponível na porta `8080`, e o Actuator, na porta `8081`.

Verifique a saúde da aplicação:

```bash
curl http://localhost:8081/actuator/health
```

Resposta esperada:

```json
{
  "status": "UP"
}
```

A imagem executa com o usuário `1001` e sistema de arquivos raiz somente leitura. O diretório `/tmp` permanece gravável por meio de um volume temporário, utilizado pela JVM e pelo Tomcat.

O agente OpenTelemetry está anexado, mas desabilitado por padrão. Para habilitá-lo, configure:

```env
OTEL_SDK_DISABLED=false
OTEL_EXPORTER_OTLP_ENDPOINT=<endpoint-otlp>
```

## Tools API

A `tools-api` disponibiliza dois endpoints principais.

### `POST /tools/unshorten`

Resolve redirecionamentos de URLs e tenta identificar o destino final de links encurtados.

Inclui proteção contra SSRF e mecanismos adicionais para resolver links com anúncios, conforme a configuração do serviço.

O resolvedor de navegador headless pode ser habilitado com:

```env
BROWSER_RESOLVER=on
```

Também é possível configurar `BYPASS_API_URL` para consultar um serviço externo de bypass. A chave desse serviço é opcional.

O sistema não resolve captchas nem acessa endereços de verificação de etapas.

### `POST /tools/scan`

Encaminha solicitações para a API do VirusTotal. A chave permanece exclusivamente no servidor, sem exposição ao frontend.

### Testes

```bash
cd tools-api
npm test
```

## Testando a API

O contrato da API está definido em [`docs/openapi.yaml`](docs/openapi.yaml).

A documentação interativa está disponível em:

http://localhost:8080/swagger-ui.html

A sessão utiliza um cookie `HttpOnly`, gerenciado automaticamente pelo navegador.

Para testar pelo Postman, importe o diretório `postman/` ou o arquivo `docs/openapi.yaml`.

### Cookies em HTTP local

O cookie de sessão utiliza HTTPS por padrão. Para testes locais em HTTP, configure no `.env`:

```env
SESSION_COOKIE_SECURE=false
```

**Nunca desabilite essa proteção em produção.**

## Rodando integrado e E2E

### Front e back juntos

No desenvolvimento, o front fala com a API pela mesma origem: o Vite (porta `5173`) encaminha
`/api/*` e `/r/*` para o backend (porta `8080`) e `/tools/*` para a Tools API (porta `3001`).
Assim o cookie de sessão funciona sem CORS. Em produção, o nginx da imagem do front faz o mesmo
papel (`API_URL` e `TOOLS_API_URL`, ver `frontend/README.md`).

Para subir tudo:

1. Backend (já sobe o Postgres): `./scripts/dev-backend.sh` ou `./scripts/dev-backend-docker.sh`.
2. Front: `cd frontend && npm install && npm run dev`.
3. Tools API, se for usar "Revelar destino": veja [Frontend e ferramentas](#frontend-e-ferramentas).

Confira se o proxy chegou na API: `curl -i http://localhost:5173/api/me` deve responder `401`.

O link curto é `{PUBLIC_BASE_URL}/{code}` e abre a **Travessia**, uma tela do front que mostra o
destino antes de seguir. Por isso, no `.env` de desenvolvimento, `PUBLIC_BASE_URL` aponta para o
Vite (`http://localhost:5173`). O `/r/{code}` é outra coisa: um redirect 302 direto do backend,
para robôs e teste de carga.

Como o backend recusa destino no próprio host, criar um portal para `localhost` dá erro de loop
(`SELF_LOOP`) no desenvolvimento. Use um domínio externo, como `https://example.com`.

### Testes E2E

Os testes E2E (Playwright, em `frontend/e2e/`) rodam contra a stack real. O `npm run e2e` sobe o
backend e o Vite do próprio checkout, com rate limit desligado e um `JWT_SECRET` gerado na hora;
só o banco precisa estar de pé antes:

```bash
docker compose up -d db
cd frontend
npx playwright install chromium   # só na primeira vez
npm run e2e                        # ou npm run e2e:ui, com a interface do Playwright
```

As portas `5173`, `8080` e `8081` precisam estar livres: pare o `npm run dev` e o backend antes.
A primeira subida do backend demora, porque o Maven compila o projeto.

No CI, o job `e2e` do `ci.yml` roda a mesma suíte com o Postgres como serviço. Se ele falhar, os
traces do Playwright ficam no artefato `playwright-traces` da execução.

### Roteiro manual

Antes de um PR que mexa em sessão, portais, Travessia ou Proteção, siga o
[roteiro de teste manual](docs/integracao/roteiro-manual.md): dez passos no navegador, do
cadastro ao portal fechado.

## Gitflow

O projeto utiliza o seguinte fluxo:

```text
main
 └── develop
      ├── feature/*
      └── outras branches de desenvolvimento
```

- `main`: código de produção.
- `develop`: branch de integração das funcionalidades.
- `feature/*`: branches de desenvolvimento de funcionalidades.
- `hotfix/*`: correções urgentes derivadas de `main`.
- Releases: preparadas a partir de `develop` e integradas a `main` após validação.

As funcionalidades devem ser integradas à `develop` por pull requests. A `main` deve receber apenas versões validadas para produção.

## Git LFS

Os arquivos PNG são versionados com Git LFS. Execute o comando abaixo antes do primeiro clone ou commit que dependa desses arquivos:

```bash
git lfs install
```