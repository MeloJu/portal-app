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

## Imagem Docker do backend

O CI publica imagens em `ghcr.io/meloju/portal-app/backend` a cada push em `main` ou `develop`, conforme o workflow `publish-backend.yml`.

Em pull requests, a imagem é construída para validar o Dockerfile, sem publicação.

As tags são:

- Nome da branch.
- `sha-<commit>`.
- `latest`, somente em `main`.

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