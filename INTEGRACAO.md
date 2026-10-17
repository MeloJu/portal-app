# Integração Front ↔ Back — Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para acompanhar o progresso.

**Objetivo:** trocar os mocks do `frontend/` pelas rotas reais do `backend/` (auth por cookie, portais, Travessia, Visão geral, Viagens e Proteção) e cobrir os fluxos principais com testes E2E em Playwright contra a stack real rodando localmente.

**Arquitetura:** o front fala com a API pela **mesma origem**, porque o proxy do Vite encaminha `/api` e `/r` para `localhost:8080`. Uma camada fina em `src/api/` (cliente HTTP + uma função tipada por endpoint do `docs/openapi.yaml`) isola o `fetch`. As seções do `Dashboard.tsx` são extraídas, uma de cada vez, para componentes próprios no momento em que ganham dados reais. A sessão é o cookie `HttpOnly` `lumi_session`: o front nunca lê o token, e quem diz se o usuário está logado é `GET /api/me`.

**Stack:** React 19, React Router 7 (data router com loaders), Vite 8, Vitest 4 + Testing Library, Playwright (novo), Spring Boot 4 (já pronto).

**Spec:** este documento. As decisões vieram de uma sessão de brainstorming e estão resumidas em "Decisões já tomadas". O contrato é o `docs/openapi.yaml`, e as regras de segurança estão em `backend/docs/SECURITY.md`.

## Estado atual (17/10/2026)

> Este plano foi escrito antes do código. Onde o código real diverge do que está nas seções de cada task, **vale o código**, e as divergências conhecidas estão listadas abaixo. Antes de seguir números de linha, confira o arquivo.

- **No `develop`:** I0.1 a I0.5, I1.1 a I1.3, I1.5, I1.6, I3.1 (primeira parte), I3.2, I3.3, I5.1 e I5.4.
- **Em branch, aguardando PR:** `feature/i3.1-visao-geral-final` (portais recentes reais, recarga ao criar portal, `api/dashboard.ts` no `request`), `feature/i3.4-viagens` e `feature/i3.5-protecao`. As três saíram do `develop` e não conflitam entre si.
- **Em branch, aguardando PR (E2E):** `feature/i2.1-playwright-e2e` (infra do Playwright + spec de auth) e `feature/i2.2-e2e-portal` (spec do portal, saída da I2.1). `npm run e2e` → 9 passando.
- **Pendente:** I1.4 (parcial), I4.1, I4.2, I5.2 e I5.3.
- **Pendência de segurança (Foco de revisão #1):** o `client.ts` dispara `lumi:unauthorized` no 401, mas **ninguém escuta esse evento**. Falta o listener no `App.tsx` previsto na I1.1 (`router.navigate("/login")` quando o pathname é `/dashboard`). Hoje, sessão expirada com o dashboard aberto não volta para o login.

**Divergências entre o plano e o código:**

1. **Pasta:** os componentes extraídos ficam em `frontend/src/app/components/`, não em `sections/`.
2. **Duas camadas de API convivem:** `lumi.ts` (uma função por endpoint, usada por `PortalsSection`, `TravelsSection` e `ProtectionSection`) e os módulos mais antigos `auth.ts`, `links.ts`, `travel.ts` e `dashboard.ts`, usados por login, `CreatePortalForm`, Travessia e Visão geral. Unificar tudo no `lumi.ts` ficou para a I4.1.
3. **Visão geral (I3.1):** não existe `OverviewStats` com `refreshKey`. São três componentes em `components/OverviewPanels.tsx` (`StatsGrid`, `OrbitStation`, `TravelFlowPanel`) que recebem os dados de `useOverview.ts`. Esse hook consulta a cada 5 s, de novo quando a aba volta ao foco, e na hora quando o `version` muda (o `Dashboard` incrementa no `onCreated` do `CreatePortalForm`). O top usa `limit=3`. O card "Portais recentes" é o `components/RecentPortals.tsx` (`api.listLinks({ size: 3 })`).
4. **Meus portais (I3.2):** paginação de 20 por página (I5.4), não `size: 100`.
5. **Cards sem fonte:** em Viagens e Proteção, os cards removidos (decisão 6) deram lugar a 3 colunas. Em Proteção, o 3º card é a quebra por motivo.
6. **Título do dashboard fixo (I1.4):** o `h1` da Visão geral ainda é "Olá, Ana…" (`pageHeadings`). Por isso o E2E de cadastro confere o nome no perfil (`.profile`). Correção: `fix/i1.4-titulo-dashboard`, depois do merge da I3.1; em seguida o E2E volta a conferir o `h1`.
7. **Prefixo do alias (I1.6):** o campo ainda mostra `l2.to/`, e não `{location.host}/`. Correção: `fix/i1.6-prefixo-alias`.
8. **Rate limit no E2E (I2.1):** `RATE_LIMIT_ENABLED` não existe. A propriedade é `app.rate-limit.enabled`, sem placeholder no `application.yml`; o nome que o Spring aceita do ambiente é `APP_RATELIMIT_ENABLED`. O padrão é 60 por minuto por IP, e não 10 por hora.
9. **Mensagens de erro (I1.2, I1.5, I2.x):** login, cadastro e Travessia mostram textos próprios do front, e não a `message` da API (decisão 8). Os testes conferem o texto que está no código.

## 5. Tasks

Cada task numa branch `feature/<id>-<nome>` com PR pra `develop`. O detalhe de cada uma (arquivos, testes, comandos) está na seção com o mesmo ID mais abaixo.

**Base (bloqueia todo o resto)**

- [x] I0.1: `ReservedAliases` + `dashboard`, `tools`, `healthz` (com teste), porque o link curto vira `/{code}` e não pode sequestrar rota do front
- [x] I0.2: proxy do Vite (`/api` e `/r` → `localhost:8080`) + `PUBLIC_BASE_URL=http://localhost:5173` no `.env.example`
- [x] I0.3: `src/api/client.ts`: `request<T>()` com `credentials: "same-origin"`, `ApiError { status, code, message }` lendo o `Error` do contrato, evento `lumi:unauthorized` no 401
- [x] I0.4: `src/api/lumi.ts`: tipos do `openapi.yaml` + uma função por endpoint (`api.login`, `api.createLink`, `api.travel`…)
- [x] I0.5: `useApi<T>()` (`data`, `error`, `loading`, `reload`) + `format.ts` (`formatNumber` pt-BR, `formatPct` com `null` → "—", `shortLabel`, `relativeTime`)

**Integração 1: auth + caminho quente**

- [x] I1.1: guardas de rota via loader + `GET /api/me` (401 → `/login`); sai o `localStorage["lumi-session"]`; 401 no meio do uso volta pro login. **Falta o listener de `lumi:unauthorized` no `App.tsx`** (ver "Estado atual")
- [x] I1.2: login real (`POST /api/auth/login`), mostrando a mensagem da API em 401 e 429
- [x] I1.3: modo "Criar conta" na tela de login (`POST /api/auth/register`), tratando 409 e senha com menos de 8 caracteres
- [ ] I1.4: nome do usuário no dashboard (`user.name`) + "Sair" chamando `POST /api/auth/logout`. Parcial: perfil e logout estão feitos, mas o título "Olá, Ana. Pronta para decolar?" ainda é fixo (`fix/i1.4-titulo-dashboard`)
- [x] I1.5: Travessia em `/:code` com `GET /api/travel/{code}` **no loader** (num `useEffect`, o StrictMode contaria 2 Viagens); telas de 404, 423, 410 e 429; confere http/https antes do link; sai a rota `/r/:slug` do React
- [x] I1.6: `CreatePortalForm` (extraído do `Dashboard.tsx`) com `POST /api/links`; erros `INVALID_URL`, `SELF_LOOP`, `RESERVED_ALIAS` e `ALIAS_TAKEN` na tela; copiar usa a `shortUrl`. Falta o prefixo `{location.host}/` no campo de alias (`fix/i1.6-prefixo-alias`)

**E2E (logo depois do caminho quente)**

- [ ] I2.1: Playwright em `frontend/`: o `webServer` sobe o backend (`APP_RATELIMIT_ENABLED=false`, `SESSION_COOKIE_SECURE=false`, `JWT_SECRET` gerado na hora) e o Vite; Postgres via `docker compose up -d db`; helpers `registerViaApi`/`createLinkViaApi`; spec de auth (cadastro, senha errada, sem sessão, sair)
- [ ] I2.2: spec do portal: criar pela tela → a Travessia mostra o destino; uma visita conta **uma** Viagem; pausado mostra aviso; alias `dashboard` e destino `localhost` recusados

🚩 **Ponto de controle:** o fluxo principal funciona e tem teste. Se o tempo acabar, para aqui.

**Integração 2: telas de leitura**

- [x] I3.1: `OverviewStats`: cards de `/api/dashboard/summary`, gráfico de `/travels?days=12`, top de `/top-links`; recarrega quando cria portal; estado vazio pra usuário novo
- [x] I3.2: `PortalsSection`: `GET /api/links?state=` com filtros Todos, Ativos, Pausados e Fechados (sai "Agendados"), paginado de 20 em 20 (I5.4)
- [x] I3.3: pausar/retomar (`PATCH { paused }`) e fechar com confirmação inline (`DELETE`), sem `window.confirm`
- [x] I3.4: `TravelsSection`: summary + `/travels?days=30` + `/countries` com nome do país em pt-BR; estado vazio de país (GeoIP ainda não preenche); saem "Viajantes únicos" e "Tempo até o destino"
- [x] I3.5: `ProtectionSection`: `/api/protection/summary` + `/events` com rótulo pt-BR por motivo; saem "Índice de proteção" e "Tráfego filtrado"

**Fechamento**

- [ ] I4.1: limpeza dos mocks (só Conquistas e Configurações continuam mock), `docs/integracao/roteiro-manual.md` com 10 passos, seção "Rodando integrado e E2E" no README
- [ ] I4.2: verificação final: `format:check`, `typecheck`, `test`, `build`, `./mvnw verify`, `npm run e2e` e o roteiro manual

**Depois do núcleo**

- [x] I5.1 (bom ter): `GET /api/links/{code}/stats` no card do portal (humanos × robôs)
- [ ] I5.2: `location /api/` e `/r/` no nginx do front + Ingress (gitops)
- [ ] I5.3: job de E2E no GitHub Actions (Postgres de serviço + Java + Node)
- [x] I5.4: paginação em "Meus portais"

## Decisões já tomadas (não reabrir)

1. **Escopo:** ligar toda tela que tem endpoint. **Conquistas** e **Configurações** continuam mock, porque não têm rota no back.
2. **Sem infra:** não mexer em nginx (`frontend/docker/`), Dockerfiles, Ingress nem gitops. O proxy do Vite é configuração de dev do front e entra no escopo.
3. **Link curto = `{PUBLIC_BASE_URL}/{code}` → Travessia.** A rota do React passa de `/r/:slug` para `/:code`. O `/r/{code}` fica só para o backend (redirect 302 direto, para robôs e teste de carga), e no dev o Vite encaminha `/r` para a API.
4. **Sessão por cookie.** Sai o `localStorage["lumi-session"]`. Guardas de rota usam loader + `GET /api/me`. Para sair, `POST /api/auth/logout`.
5. **Travessia chama a API no loader, nunca em `useEffect`.** O `<React.StrictMode>` do `main.tsx` roda efeitos duas vezes em dev, e cada `GET /api/travel/{code}` registra uma Viagem.
6. **Métricas sem fonte no back são removidas, não inventadas.** Exemplos: "Viajantes únicos", "Tempo até o destino", "Índice de proteção", "Tráfego filtrado" e o status "Agendado".
7. **E2E:** Playwright contra a stack real (Postgres do compose + backend + Vite). Unitários do front continuam no Vitest, com `fetch` mockado via `vi.stubGlobal`. **Não adicionar MSW.**
8. **Mensagens de erro são do front.** Login, cadastro e Travessia mostram textos próprios, no tom da Lumi, escolhidos pelo `code`/status da API, e não a `message` crua dela. A validação da API vem técnica e em inglês. Exceção: os erros de criação de portal (`INVALID_URL`, `SELF_LOOP`, `RESERVED_ALIAS`, `ALIAS_TAKEN`) mostram a `message` da API.
9. **O alias é normalizado no front** antes do envio: tira acentos, passa para minúsculas e troca o resto por hífen ("Promoção de Verão" → `promocao-de-verao`). O back continua validando `^[a-zA-Z0-9-]{3,32}$`.

## Restrições globais

- Git: **cada task numa branch `feature/<id>-<nome>`** criada a partir de `develop` atualizado (ex.: `feature/i0.3-cliente-http`), com **PR pra `develop`** (gitflow do repo: `main` ← `develop` ← `feature/*`). Commits em Conventional Commits, em português, como no histórico. Abrir o PR com `gh pr create --base develop`. Tasks independentes podem andar em paralelo, cada uma saindo do `develop`. Antes do push, conferir se a branch conflita com as outras abertas (`git merge-tree --write-tree <outra-branch> HEAD`). Tasks que dependem de outra só começam depois do merge dela. Nunca commitar direto em `develop`/`main`.
- Todo arquivo novo do front passa no `npm run format:check`. O `src/app/Dashboard.tsx` está no `.prettierignore`: não formatar esse arquivo inteiro (geraria ~900 linhas de diff).
- Antes de cada commit do front: `cd frontend && npm run typecheck && npm test`. Antes de cada commit do back: `cd backend && ./mvnw -B test -Dtest=<classe>`.
- Não adicionar dependências além de `@playwright/test` (devDependency do `frontend/`).
- Textos de UI em português, no tom que o app já usa ("portal", "viagem", "Lumi", "estação").
- Este documento não é a fonte dos textos de UI que já existem. Quando um passo cita uma mensagem de tela, o teste confere o texto que está no código (componente ou API), não o daqui. Textos citados em task ainda não feita são a proposta de copy.
- Sem comentários no código (JSDoc, bloco ou linha). Explicação vai no PR ou na mensagem de commit.
- Nada de segredo no código. O `JWT_SECRET` dos testes E2E é gerado na hora (ver I2.1). O CI já roda gitleaks.
- Destino só `http`/`https`: antes de renderizar ou redirecionar para um `targetUrl`, o front confere o esquema de novo (SECURITY.md, seção 2).
- Manter as classes CSS e a marcação existentes ao extrair componentes. A mudança é de dados, não de visual.

## Ambiente local

- Portas fixas: Vite `5173`, API `8080`, actuator `8081`, Postgres `5432`. Dois checkouts (ou worktrees) não sobem a stack ao mesmo tempo.
- O `docker-compose.yml` fixa `container_name: lumi-db`. Se outro checkout já subiu o banco, o `docker compose up -d db` falha com conflito de nome; reaproveite o `lumi-db` que está de pé (mesmo banco, usuário e senha `lumi`).
- O `npm run e2e` sempre sobe o backend e o Vite do próprio checkout (`reuseExistingServer: false`). Se as portas 5173/8080/8081 estiverem ocupadas, o Playwright falha logo; pare o dev server antes.
- No Windows o wrapper do Maven é `.\mvnw.cmd`; o `playwright.config.ts` escolhe pela plataforma.
- Variáveis do backend: só valem as que o `application.yml` lê por placeholder (`DB_URL`, `DB_USER`, `DB_PASSWORD`, `PUBLIC_BASE_URL`, `JWT_SECRET`, `SESSION_COOKIE_SECURE`, `GEOIP_DB_PATH`). O resto se configura pelo nome relaxado do Spring, ex.: `app.rate-limit.enabled` → `APP_RATELIMIT_ENABLED`.
- Rate limit padrão (`AppProperties.RateLimit`): 60 requisições por minuto por IP em login, cadastro e Travessia.

## Foco de revisão (fora do caminho feliz)

1. **Sessão expirada no meio do uso** (cookie de 8 h vence com o dashboard aberto): qualquer 401 vindo da API deve mandar para `/login`, e não mostrar tela quebrada. Testado na I1.1.
2. **Contagem dupla de Viagem** no StrictMode ou em revalidação do router: uma visita à Travessia conta **uma** Viagem. Testado na I2.2 (E2E).
3. **Alias que colide com rota do front** (`dashboard`, `login`…): o back recusa com `RESERVED_ALIAS`. Testado na I0.1.
4. **Rate limit (429)** no login e na Travessia: aparece a mensagem da API, não um erro genérico. Testado nas I1.2 e I1.5.
5. **Usuário novo, sem nenhum dado**: Visão geral, Viagens e Proteção mostram zeros ou estado vazio, sem `NaN`, sem `undefined` e sem lista mockada. `travelsChangePct` pode vir `null`. Testado nas I3.1, I3.4 e I3.5.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `backend/src/main/java/dev/l2/api/link/ReservedAliases.java` | + `dashboard`, `tools`, `healthz` |
| `frontend/vite.config.ts` | proxy `/api` e `/r` → `:8080` |
| `frontend/src/api/client.ts` (novo) | `request<T>()`, `ApiError`, evento de 401 |
| `frontend/src/api/lumi.ts` (novo) | tipos do contrato + uma função por endpoint |
| `frontend/src/api/auth.ts`, `links.ts`, `travel.ts`, `dashboard.ts` | módulos anteriores ao `lumi.ts`, ainda em uso (login, criar portal, Travessia, Visão geral); unificar na I4.1 |
| `frontend/src/api/useApi.ts` (novo) | hook de GET com `{ data, error, loading, reload }` |
| `frontend/src/app/format.ts` (novo) | `formatNumber`, `formatPct`, `shortLabel`, `relativeTime` |
| `frontend/src/app/routes.tsx` | loaders de sessão (`currentUser()`) + rota `/:code`; não existe `session.ts` |
| `frontend/src/app/pages/LoginPage.tsx` | login e cadastro reais |
| `frontend/src/app/pages/TravelPage.tsx` | Travessia lendo do loader, com estados de erro |
| `frontend/src/app/components/*.tsx` | `CreatePortalForm`, `OverviewPanels`, `RecentPortals`, `PortalsSection`, `PortalCard`, `PortalDetail`, `TravelsSection`, `ProtectionSection` |
| `frontend/src/app/useOverview.ts` | dados da Visão geral, consultados a cada 5 s ou na hora quando muda o `version` |
| `frontend/src/app/Dashboard.tsx` | perde os mocks e passa a compor as seções |
| `frontend/playwright.config.ts`, `frontend/e2e/*.ts` | E2E (`helpers.ts`, `auth.spec.ts`, `portal.spec.ts`) |
| `docs/integracao/roteiro-manual.md` (novo) | roteiro de teste manual |
| `README.md` | seção "Rodando integrado e E2E" |

---

### I0.1: Back reserva os aliases que colidem com rotas do front

**Arquivos:**
- Modificar: `backend/src/main/java/dev/l2/api/link/ReservedAliases.java`
- Teste: `backend/src/test/java/dev/l2/api/link/ReservedAliasesTests.java`

**Interfaces:** nenhuma nova. O `RESERVED` passa a ter `"api", "r", "assets", "otlp", "health", "login", "register", "index.html", "dashboard", "tools", "healthz"`.

- [ ] **Passo 1:** `git checkout develop && git pull && git checkout -b feature/i0.1-aliases-reservados`
- [ ] **Passo 2:** no `@ValueSource` de `rejectsEveryReservedAlias`, acrescentar `"dashboard", "tools", "healthz"`. No de `ignoresCase`, acrescentar `"Dashboard"`.
- [ ] **Passo 3:** `cd backend && ./mvnw -B test -Dtest=ReservedAliasesTests` → **FALHA** em `dashboard`.
- [ ] **Passo 4:** acrescentar os três valores ao `Set.of(...)`.
- [ ] **Passo 5:** rodar de novo → **PASSA**.
- [ ] **Passo 6:** `git commit -am "feat(api): reserva aliases que colidem com rotas do front"`

### I0.2: Proxy do Vite para a API

**Arquivos:** modificar `frontend/vite.config.ts` e `.env.example`

- [ ] **Passo 1:** `server.proxy` passa a ser `{ "/tools": "http://localhost:3001", "/api": "http://localhost:8080", "/r": "http://localhost:8080" }`.
- [ ] **Passo 1b:** no `.env.example`, `PUBLIC_BASE_URL=http://localhost:5173`, com o comentário "no dev o link curto abre a Travessia no Vite; em produção é o domínio público". Sem isso, o `shortUrl` aponta para `:8080/{code}`, que dá 404 no backend. Obs.: o `UrlValidator` compara só o host, então qualquer destino `localhost` vira `SELF_LOOP` no dev, e isso é esperado.
- [ ] **Passo 2:** verificação manual, que exige a stack de pé:
  `cp .env.example .env` na raiz (preencher `JWT_SECRET` com `openssl rand -base64 32`), depois `docker compose up -d db`, depois `cd backend && set -a && . ../.env && set +a && ./mvnw spring-boot:run`, depois `cd frontend && npm run dev`.
  Esperado: `curl -i localhost:5173/api/me` responde `401` (o proxy chegou na API).
- [ ] **Passo 3:** `git commit -am "chore(frontend): proxy de /api e /r para o backend no dev"`

### I0.3: Cliente HTTP (`client.ts`)

**Arquivos:** criar `frontend/src/api/client.ts` e `frontend/src/api/client.test.ts`

**Interfaces (produz):**
```ts
export class ApiError extends Error { constructor(public status: number, public code: string, message: string) }
export const UNAUTHORIZED_EVENT = "lumi:unauthorized";
export function request<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T>;
```

- [ ] **Passo 1: testes que falham** (`fetch` via `vi.stubGlobal("fetch", vi.fn())`):
  - `envia JSON com credentials same-origin`: `request("POST", "/api/x", { a: 1 })` chama `fetch("/api/x", expect.objectContaining({ method: "POST", credentials: "same-origin", body: '{"a":1}' }))` com header `content-type: application/json`.
  - `devolve o corpo em 2xx`: resposta 200 `{ ok: true }` resolve `{ ok: true }`.
  - `resolve undefined em 204`.
  - `lança ApiError com code e message do corpo`: 409 `{ code: "ALIAS_TAKEN", message: "Esse nome de portal já foi pego" }` rejeita com `ApiError` de `status 409`, `code "ALIAS_TAKEN"` e essa `message`.
  - `usa mensagem genérica quando o corpo não é JSON`: 500 sem corpo rejeita com `code "UNKNOWN"`.
  - `erro de rede vira ApiError NETWORK`: `fetch` rejeita, e o resultado é `status 0`, `code "NETWORK"`.
  - `401 dispara o evento de sessão expirada`: um listener em `window` para `UNAUTHORIZED_EVENT` é chamado uma vez, e mesmo assim lança `ApiError` 401.
- [ ] **Passo 2:** `npx vitest run src/api/client.test.ts` → FALHA (módulo não existe).
- [ ] **Passo 3:** implementar seguindo o padrão de `src/api/tools.ts`. Sem body, não manda `content-type`. Mensagem de rede: "Não foi possível falar com a Lumi. Verifique sua conexão e tente de novo." Genérica: "Algo deu errado. Tente novamente."
- [ ] **Passo 4:** rodar → PASSA.
- [ ] **Passo 5:** `npm run format && git add src/api/client* && git commit -m "feat(frontend): cliente HTTP da API com ApiError"`

### I0.4: Funções tipadas do contrato (`lumi.ts`)

**Arquivos:** criar `frontend/src/api/lumi.ts` e `frontend/src/api/lumi.test.ts`

**Interfaces (produz).** Tipos copiados dos schemas do `docs/openapi.yaml`:
```ts
export type LinkState = "ACTIVE" | "PAUSED" | "CLOSED";
export type BlockedReason = "INVALID_URL" | "SELF_LOOP" | "RESERVED_ALIAS" | "PAUSED" | "CLOSED" | "RATE_LIMIT";
export interface User { id: string; name: string; email: string }
export interface Link { code: string; shortUrl: string; targetUrl: string; title: string | null; state: LinkState; travelCount: number; expiresAt: string | null; maxTravels: number | null; createdAt: string }
export interface LinkPage { items: Link[]; page: number; totalItems: number }
export interface CreateLinkInput { targetUrl: string; alias?: string; title?: string; expiresAt?: string; maxTravels?: number }
export interface UpdateLinkInput { targetUrl?: string; title?: string | null; paused?: boolean; expiresAt?: string | null; maxTravels?: number | null }
export interface TravelResponse { targetUrl: string; title: string | null; travelCount: number }
export interface TimePoint { date: string; travels: number }
export interface CountryCount { country: string; travels: number }
export interface LinkStats { code: string; totalTravels: number; humanTravels: number; botTravels: number; travelsByDay: TimePoint[]; countries: CountryCount[] }
export interface DashboardSummary { activeLinks: number; totalTravels: number; travelsChangePct: number | null; blockedThreats: number }
export interface TopLink { code: string; title: string | null; travels: number }
export interface ProtectionSummary { blockedThreats: number; verifiedDestinations: number; byReason: Record<BlockedReason, number> }
export interface BlockedEvent { reason: BlockedReason; code: string | null; occurredAt: string }

export const api = {
  register(name: string, email: string, password: string): Promise<{ expiresIn: number; user: User }>,
  login(email: string, password: string): Promise<{ expiresIn: number; user: User }>,
  logout(): Promise<void>,
  me(): Promise<User>,
  listLinks(params?: { state?: LinkState; page?: number; size?: number }): Promise<LinkPage>,
  createLink(input: CreateLinkInput): Promise<Link>,
  updateLink(code: string, input: UpdateLinkInput): Promise<Link>,
  closeLink(code: string): Promise<void>,
  linkStats(code: string, days?: number): Promise<LinkStats>,
  travel(code: string): Promise<TravelResponse>,
  dashboardSummary(days?: number): Promise<DashboardSummary>,
  dashboardTravels(days?: number): Promise<TimePoint[]>,
  topLinks(limit?: number): Promise<TopLink[]>,
  countries(): Promise<CountryCount[]>,
  protectionSummary(): Promise<ProtectionSummary>,
  protectionEvents(limit?: number): Promise<BlockedEvent[]>,
};
```

- [ ] **Passo 1: testes que falham** (`vi.mock("./client")` e checagem dos argumentos de `request`):
  - `listLinks monta a query só com o que veio`: `api.listLinks({ state: "PAUSED", size: 50 })` chama `request("GET", "/api/links?state=PAUSED&size=50")`, e `api.listLinks()` chama `request("GET", "/api/links")`.
  - `travel codifica o código`: `api.travel("a b")` chama `request("GET", "/api/travel/a%20b")`.
  - `updateLink usa PATCH com o corpo`: `api.updateLink("x", { paused: true })` chama `request("PATCH", "/api/links/x", { paused: true })`.
- [ ] **Passo 2:** rodar → FALHA.
- [ ] **Passo 3:** implementar com `URLSearchParams` (pulando `undefined`) e `encodeURIComponent` em todo `{code}`.
- [ ] **Passo 4:** rodar → PASSA.
- [ ] **Passo 5:** `npm run format && git add src/api/lumi* && git commit -m "feat(frontend): funções tipadas do contrato da API"`

### I0.5: Hook `useApi` e formatadores

**Arquivos:** criar `frontend/src/api/useApi.ts`, `frontend/src/api/useApi.test.tsx`, `frontend/src/app/format.ts` e `frontend/src/app/format.test.ts`

**Interfaces (produz):**
```ts
export function useApi<T>(load: () => Promise<T>, deps: unknown[]): { data: T | undefined; error: ApiError | undefined; loading: boolean; reload: () => void };
export function formatNumber(n: number): string;        // pt-BR: 8429 → "8.429"
export function formatPct(p: number | null): string;    // 18.4 → "+18,4%", -20 → "-20,0%", null → "—"
export function shortLabel(shortUrl: string): string;   // "http://localhost:8080/abc" → "localhost:8080/abc"
export function relativeTime(iso: string, now?: Date): string; // "Há 12 min", "Há 3 h", "Há 2 dias", "Agora"
```

- [ ] **Passo 1: testes que falham:**
  - `useApi`: começa com `loading true`. Depois da promessa, vira `data` preenchido e `loading false`. Se a promessa rejeita com `ApiError`, preenche `error`. `reload()` chama `load` de novo. Resultado que chega depois do unmount não gera warning (flag `cancelled`).
  - `format`: os exemplos dos comentários acima, com os valores exatos.
- [ ] **Passo 2:** rodar → FALHA.
- [ ] **Passo 3:** implementar. `formatNumber` usa `Intl.NumberFormat("pt-BR")`. `useApi` usa `useEffect` + `useState` (GET duplicado no StrictMode é inofensivo aqui, só a Travessia importa).
- [ ] **Passo 4:** rodar → PASSA.
- [ ] **Passo 5:** commit `feat(frontend): hook useApi e formatadores`

### I1.1: Sessão e guardas de rota

**Arquivos:** criar `frontend/src/app/session.ts` e `frontend/src/app/session.test.ts`. Modificar `frontend/src/app/routes.tsx` e `frontend/src/app/App.tsx`.

**Interfaces:**
- Consome: `api.me()` e `UNAUTHORIZED_EVENT` (I0.3 e I0.4).
- Produz:
  ```ts
  export async function requireUser(): Promise<User>;          // loader: 401 → throw redirect("/login")
  export async function redirectIfLoggedIn(): Promise<null>;   // loader: 200 → throw redirect("/dashboard"); 401 → null
  export function useCurrentUser(): User;                      // useRouteLoaderData("dashboard")
  ```
  A rota `/dashboard` ganha `id: "dashboard"` e `loader: requireUser`. A rota `/` vira `loader: async () => redirect((await isLoggedIn()) ? "/dashboard" : "/login")`. A rota `/login` usa `redirectIfLoggedIn`.

- [ ] **Passo 1: testes que falham** (`api.me` mockado):
  - `requireUser devolve o usuário quando /api/me responde 200`.
  - `requireUser redireciona para /login no 401`: a `Response` lançada tem `status 302` e header `Location: /login`.
  - `redirectIfLoggedIn manda logado para /dashboard`, e devolve `null` no 401.
  - `erro diferente de 401 propaga` (500 não vira redirect silencioso).
- [ ] **Passo 2:** rodar → FALHA.
- [ ] **Passo 3:** implementar. No `App.tsx`, um `useEffect` escuta `UNAUTHORIZED_EVENT` e faz `router.navigate("/login")` quando o pathname atual é `/dashboard` (Foco de revisão #1). Remover `hasSession()` e qualquer leitura de `lumi-session`.
- [ ] **Passo 4:** rodar → PASSA. Os testes do `Dashboard.test.tsx` que renderizam `/dashboard` sem loader continuam passando.
- [ ] **Passo 5:** commit `feat(frontend): guardas de rota pela sessão do cookie`

### I1.2: Login real

**Arquivos:** modificar `frontend/src/app/pages/LoginPage.tsx` e `frontend/src/app/pages/LoginPage.test.tsx`

**Interfaces:** consome `api.login` e `ApiError`.

- [ ] **Passo 1:** reescrever os testes (`api` mockado com `vi.mock("../../api/lumi")`):
  - mantém `mostra erro quando e-mail ou senha estão vazios` (sem chamar `api.login`) e `alterna a visibilidade da senha`.
  - `chama a API e navega para o dashboard`: `api.login` resolve, o pathname vira `/dashboard`, e foi chamado com `("ana@lumi.studio", "segredo-grande")`.
  - `mostra a mensagem da API em credenciais inválidas`: rejeita com `ApiError(401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos")`, o `alert` mostra "E-mail ou senha inválidos" e o botão volta a ficar habilitado.
  - `mostra a mensagem do rate limit`: `ApiError(429, "RATE_LIMIT", "Muitas tentativas em pouco tempo. Tente de novo daqui a pouco.")` aparece no `alert`.
  - remover toda asserção sobre `localStorage["lumi-session"]`.
- [ ] **Passo 2:** rodar → FALHA.
- [ ] **Passo 3:** `signIn` vira `async`: `setLoading(true)`, `await api.login(...)`, `navigate("/dashboard")`. No `catch`, `setError(err.message)` e `setLoading(false)`. Remover o `setTimeout` e o `localStorage`.
- [ ] **Passo 4:** rodar → PASSA.
- [ ] **Passo 5:** commit `feat(frontend): login pela API`

### I1.3: Modo "Criar conta" no login

**Arquivos:** os mesmos da I1.2.

- [ ] **Passo 1: testes que falham:**
  - `alterna para criar conta e mostra o campo nome`: o botão "Criar conta" mostra o input com placeholder "Como podemos te chamar?" e muda o submit para "Criar minha estação".
  - `cadastra e navega`: `api.register` chamado com `("Ana", "ana@lumi.studio", "segredo-grande")` e o pathname vira `/dashboard`.
  - `mostra conflito de e-mail`: `ApiError(409, "EMAIL_TAKEN", "E-mail já cadastrado")` aparece no `alert`.
  - `valida senha curta antes de chamar a API`: senha "curta" mostra "A senha precisa ter pelo menos 8 caracteres." e `api.register` não é chamado.
- [ ] **Passo 2:** rodar → FALHA.
- [ ] **Passo 3:** estado `mode: "login" | "register"`. Mesmo formulário, com o campo nome visível só no cadastro. Link para voltar: "Já tenho conta".
- [ ] **Passo 4:** rodar → PASSA.
- [ ] **Passo 5:** commit `feat(frontend): cadastro de usuário na tela de login`

### I1.4: Nome do usuário e logout no Dashboard

**Arquivos:** modificar `frontend/src/app/Dashboard.tsx` e `frontend/src/app/Dashboard.test.tsx`

**Interfaces:** consome `useCurrentUser()` e `api.logout()`.

- [ ] **Passo 1:** em `Dashboard.test.tsx`, o `renderDashboard()` passa a registrar a rota com `id: "dashboard"` e `loader: () => ({ id: "u1", name: "Bia Souza", email: "bia@x.com" })`. Os testes que dependem de mocks e mudam em tarefas seguintes são reescritos lá, não aqui. Testes novos ou alterados:
  - `saúda o usuário logado`: o `h1` contém "Olá, Bia", e o perfil mostra "Bia Souza" e as iniciais "BS".
  - `encerra a sessão ao sair`: `api.logout` é chamado e o pathname vira `/login` (sem `localStorage`).
- [ ] **Passo 2:** rodar → FALHA.
- [ ] **Passo 3:** o título da Visão geral vira `` `Olá, ${primeiroNome}. Pronta para decolar?` ``, e "Ana Martins"/"AM" saem do `user.name`. O botão Sair faz `await api.logout().catch(() => {})` e depois `navigate("/login")`. Configurações continua mock (decisão 1).
- [ ] **Passo 4:** rodar → PASSA.
- [ ] **Passo 5:** commit `feat(frontend): usuário logado e logout reais no dashboard`

### I1.5: Travessia real em `/:code`

**Arquivos:** modificar `frontend/src/app/pages/RedirectPage.tsx`, `frontend/src/app/pages/RedirectPage.test.tsx` e `frontend/src/app/routes.tsx`

**Interfaces:**
- Consome: `api.travel(code)`.
- Produz: `export async function travelLoader({ params }): Promise<TravelResponse>` e `export function TravelError()` (o `errorElement`), os dois em `RedirectPage.tsx`. Rota: `{ path: "/:code", loader: travelLoader, Component: RedirectPage, errorElement: <TravelError /> }`, registrada **depois** de `/login` e `/dashboard` (rotas estáticas ganham da dinâmica no React Router 7). Remover a rota `/r/:slug` do React.

- [ ] **Passo 1:** reescrever os testes (`api.travel` mockado, router de memória com a rota acima):
  - `mostra o destino vindo da API e exige confirmação`: resolve `{ targetUrl: "https://example.com/campanha", title: "Campanha Nebulosa", travelCount: 3 }`. O `h1` contém "example.com", o link "Sim, prosseguir" tem `href` igual ao `targetUrl` e `rel` com `noopener`.
  - `chama a API uma única vez`: `api.travel` tem `toHaveBeenCalledTimes(1)`.
  - `404 mostra portal inexistente`: `ApiError(404, "LINK_NOT_FOUND", "Esse portal não existe")` exibe "Esse portal não existe" e não mostra o link de prosseguir.
  - `423 mostra portal pausado`: `ApiError(423, "PAUSED", "Esse portal está pausado")` exibe esse texto.
  - `410 mostra portal fechado`: `ApiError(410, "CLOSED", "Esse portal foi fechado")` exibe esse texto.
  - `429 mostra a mensagem do rate limit`.
  - `recusa destino com esquema que não é http(s)`: `targetUrl: "javascript:alert(1)"` não renderiza o link e mostra "Esse destino não parece seguro."
- [ ] **Passo 2:** rodar → FALHA.
- [ ] **Passo 3:** a página lê `useLoaderData()`. Sem `title`, cai para "Destino Lumi". Apagar o objeto `destinations`. O `TravelError` usa `useRouteError()` e reaproveita o layout `redirect-page`/`redirect-card`, com o botão "Crie seus próprios portais" → `/login`.
- [ ] **Passo 4:** rodar → PASSA.
- [ ] **Passo 5:** commit `feat(frontend): Travessia real no link curto /{code}`

### I1.6: Criar portal pela API

**Arquivos:** criar `frontend/src/app/sections/CreatePortalForm.tsx` e `frontend/src/app/sections/CreatePortalForm.test.tsx`. Modificar `frontend/src/app/Dashboard.tsx`, de onde sai a seção `creator-card` (estado `url`, `slug`, `created`, `isOpening` e `createLink`).

**Interfaces:**
- Consome: `api.createLink` e `shortLabel`.
- Produz: `export default function CreatePortalForm({ onCreated }: { onCreated?: (link: Link) => void })`.

- [ ] **Passo 1: testes que falham:**
  - `cria com alias e mostra o link curto`: `api.createLink` é chamado com `{ targetUrl: "https://exemplo.com/longo", alias: "meu-link" }` e resolve `shortUrl: "http://localhost:8080/meu-link"`. Aparece "localhost:8080/meu-link".
  - `sem alias não manda o campo`: o objeto não tem a chave `alias`.
  - `não chama a API sem URL`.
  - `mostra o erro da API`: para cada código (`INVALID_URL`, `SELF_LOOP`, `RESERVED_ALIAS`, `ALIAS_TAKEN`), a `message` do `ApiError` aparece num `role="alert"`.
  - `copiar usa a shortUrl completa`: `navigator.clipboard.writeText` recebe `"http://localhost:8080/meu-link"`.
- [ ] **Passo 2:** rodar → FALHA.
- [ ] **Passo 3:** mover a marcação do `creator-card` para o componente sem mudar as classes. O prefixo visual `l2.to/` do campo de alias vira `{location.host}/`. O alias é só `trim()` (o back valida o regex `^[a-zA-Z0-9-]{3,32}$`). O `Dashboard` renderiza `<CreatePortalForm onCreated={...} />`, e o callback será usado na I3.1 para recarregar os números.
- [ ] **Passo 4:** remover de `Dashboard.test.tsx` os testes `cria um portal com o slug personalizado normalizado` e `não cria portal sem URL` (agora cobertos aqui). Rodar `npm test` → PASSA.
- [ ] **Passo 5:** `npm run format && git add -A && git commit -m "feat(frontend): criação de portal pela API"`

### I2.1: Infra de testes E2E com Playwright + spec de auth

**Arquivos:** criar `frontend/playwright.config.ts`, `frontend/e2e/helpers.ts` e `frontend/e2e/auth.spec.ts`. Modificar `frontend/package.json`, `frontend/tsconfig.json`, `frontend/.prettierignore` e `.gitignore` da raiz.

**Interfaces (produz):**
```ts
// e2e/helpers.ts
export function uniqueEmail(): string;                                     // `e2e-${Date.now()}-${random}@example.com`
export async function registerViaApi(page: Page, name?: string): Promise<{ email: string; password: string }>; // page.request.post("/api/auth/register"): o cookie fica no contexto do browser
export async function createLinkViaApi(page: Page, input: { targetUrl: string; alias?: string; title?: string }): Promise<{ code: string; shortUrl: string }>;
```

- [ ] **Passo 1:** `cd frontend && npm i -D @playwright/test && npx playwright install chromium`
- [ ] **Passo 2:** `playwright.config.ts`: `testDir: "e2e"`, `use.baseURL: "http://localhost:5173"`, `workers: 1`, `retries: 0`, `trace: "retain-on-failure"`, projeto só `chromium`. `webServer` é um array de dois itens:
  - backend: `command: "<mvnw> -q spring-boot:run"` (`.\mvnw.cmd` no Windows, `./mvnw` nos outros), `cwd: "../backend"`, `url: "http://localhost:8081/actuator/health"`, `timeout: 180_000`, `reuseExistingServer: false`, `env` com `DB_URL=jdbc:postgresql://localhost:5432/lumi`, `DB_USER=lumi`, `DB_PASSWORD=lumi`, `PUBLIC_BASE_URL=http://localhost:5173`, `SESSION_COOKIE_SECURE=false`, **`APP_RATELIMIT_ENABLED=false`** (nome relaxado de `app.rate-limit.enabled`; o cadastro tem rate limit por IP e cada teste cria um usuário) e `JWT_SECRET` = `randomBytes(32).toString("base64")` gerado no próprio config.
  - front: `command: "npm run dev"`, `url: "http://localhost:5173"`, `reuseExistingServer: false`.
  - `reuseExistingServer: false` nos dois: com `true`, um dev server de outro checkout seria reaproveitado em silêncio, com rate limit ligado e o código de outra branch.
  - O pré-requisito (`docker compose up -d db`) fica documentado no README, na I4.1, e não em comentário no config.
  - Motivo do `PUBLIC_BASE_URL` apontar para o Vite: assim o `shortUrl` aponta para onde a Travessia roda no dev.
- [ ] **Passo 3:** scripts no `package.json`: `"e2e": "playwright test"` e `"e2e:ui": "playwright test --ui"`. No `tsconfig.json`, `include` ganha `"e2e"` e `"playwright.config.ts"`. No `.gitignore` da raiz: `frontend/test-results/`, `frontend/playwright-report/`. No `frontend/.prettierignore`: `test-results` e `playwright-report` (o Prettier só lê o `.gitignore` de `frontend/`; sem isso o `format:check` falha depois de um `npm run e2e`).
- [ ] **Passo 4:** `e2e/auth.spec.ts`:
  - `cadastro pela tela leva ao dashboard com o nome do usuário`: vai a `/login`, clica "Criar conta", preenche nome/e-mail/senha e envia. Espera a URL `/dashboard` e o nome no perfil (`.profile`). Depois da `fix/i1.4-titulo-dashboard`, volta a conferir o `h1` com o primeiro nome.
  - `login com senha errada mostra erro genérico`: `registerViaApi`, limpa os cookies, tenta logar com senha errada e vê a mensagem de credenciais inválidas da tela (`LoginPage.tsx`, `errorMessage`).
  - `sem sessão, /dashboard manda para /login`.
  - `sair encerra a sessão`: depois de clicar "Sair da conta", visitar `/dashboard` cai em `/login`.
- [ ] **Passo 5:** `docker compose up -d db && cd frontend && npm run e2e` → 4 passando. A primeira subida do backend demora.
- [ ] **Passo 6:** commit `test(e2e): Playwright contra a stack real e fluxo de autenticação`

### I2.2: E2E do portal e da Travessia

**Arquivos:** criar `frontend/e2e/portal.spec.ts`

- [ ] **Passo 1:** testes:
  - `cria portal pela tela e a Travessia leva ao destino`: `registerViaApi`, cria pelo formulário com `https://example.com/destino` e alias único. A tela mostra o link curto. `page.goto("/" + alias)` mostra "example.com". O link "Sim, prosseguir" tem `href="https://example.com/destino"` (não clicar, para não sair para a internet).
  - `uma visita à Travessia conta uma viagem só` (Foco #2): `createLinkViaApi`, `page.goto("/" + code)`, espera o `h1`. Depois `page.request.get("/api/links/" + code)` deve ter `travelCount === 1`.
  - `portal pausado mostra aviso`: cria, faz `PATCH { paused: true }` via `page.request`, visita e vê o aviso de pausado da Travessia (`TravelPage.tsx`, `blocked.paused`), sem o link de prosseguir.
  - `alias reservado é recusado na tela`: alias `dashboard` mostra a `message` de `RESERVED_ALIAS` da API (`ReservedAliases.java`).
  - `link para o próprio domínio é recusado`: destino `http://localhost:5173/x` mostra a `message` de `SELF_LOOP` da API (`UrlValidator.java`).
- [ ] **Passo 2:** `npm run e2e` → tudo passando. Se o teste da contagem falhar com 2, a I1.5 está chamando a API fora do loader. Corrigir lá.
- [ ] **Passo 3:** commit `test(e2e): criação de portal e Travessia`

> 🚩 **Ponto de controle:** a partir daqui o fluxo principal funciona e tem teste. Se o tempo acabar, parar aqui e rodar a verificação da I4.2.

### I3.1: Visão geral com dados reais

> **Como ficou:** veja "Estado atual", divergência 3. O texto abaixo é o plano original.

**Arquivos:** criar `frontend/src/app/sections/OverviewStats.tsx` e `frontend/src/app/sections/OverviewStats.test.tsx`. Modificar `frontend/src/app/Dashboard.tsx`: os `stat-card` (linhas ~389-410), a lista "recentes" (`recentLinks`), o gráfico (`chartBars`) e o bloco "Nebulosa/Orbit/Ana Design" saem para o componente.

**Interfaces:**
- Consome: `api.dashboardSummary()`, `api.dashboardTravels(12)`, `api.topLinks(5)`, `useApi`, `formatNumber`, `formatPct`.
- Produz: `export default function OverviewStats({ refreshKey }: { refreshKey: number })`. O `Dashboard` incrementa `refreshKey` no `onCreated` do `CreatePortalForm`.

- [ ] **Passo 1: testes que falham:**
  - `mostra os três cards`: com summary `{ activeLinks: 24, totalTravels: 8429, travelsChangePct: 18.4, blockedThreats: 137 }`, aparecem "24", "8.429", "+18,4%" e "137".
  - `variação nula vira travessão` (Foco #5): `travelsChangePct: null` mostra "—".
  - `gráfico tem uma barra por dia`: 12 `TimePoint` geram 12 barras, com altura proporcional ao maior valor. Se todos são 0, as alturas são 0 (sem `NaN` no `style`).
  - `top portais vem da API`: os títulos e as viagens formatadas aparecem. Sem `title`, mostra o `code`.
  - `usuário sem portais vê estado vazio`: `topLinks` `[]` mostra "Nenhuma viagem ainda. Compartilhe seu primeiro portal!"
  - `refreshKey novo recarrega`: muda a prop e `dashboardSummary` é chamado de novo.
- [ ] **Passo 2:** rodar → FALHA.
- [ ] **Passo 3:** implementar. Total do período (`2.846 viagens no período`) = soma do `dashboardTravels`. Apagar `recentLinks` e `chartBars` do `Dashboard.tsx`.
- [ ] **Passo 4:** em `Dashboard.test.tsx`, mockar `../api/lumi` com respostas vazias por padrão (`vi.mock` no topo, com `mockResolvedValue` para cada função usada) para os testes de navegação continuarem passando. Rodar `npm test` → PASSA.
- [ ] **Passo 5:** commit `feat(frontend): Visão geral com números reais`

### I3.2: "Meus portais" com lista e filtro reais

> **Como ficou:** `components/PortalsSection.tsx` + `PortalCard.tsx`, paginado de 20 em 20 (I5.4) em vez de `size: 100`.

**Arquivos:** criar `frontend/src/app/sections/PortalsSection.tsx` e `frontend/src/app/sections/PortalsSection.test.tsx`. Modificar `frontend/src/app/Dashboard.tsx`: sai o bloco `active === "Meus portais"`, o `portalCards`, o `portalFilter`, o `copyLink` e o `previewPortal`.

**Interfaces:**
- Consome: `api.listLinks`, `useApi`, `shortLabel`, `formatNumber`.
- Produz: `export default function PortalsSection()`.

- [ ] **Passo 1: testes que falham:**
  - `filtros mapeiam para o state da API`: os botões são "Todos", "Ativos", "Pausados" e "Fechados" ("Agendados" sai, decisão 6). Clicar "Pausados" chama `api.listLinks({ state: "PAUSED", size: 100 })`, e "Todos" chama sem `state`.
  - `renderiza um card por portal`: 2 itens geram 2 `article`, com título (ou `code`), `shortLabel(shortUrl)`, host do `targetUrl`, `travelCount` formatado e o status em português ("Ativo" / "Pausado" / "Fechado").
  - `copiar usa a shortUrl`: `writeText` recebe a `shortUrl` exata.
  - `lista vazia mostra estado vazio`: "Você ainda não abriu nenhum portal."
- [ ] **Passo 2:** rodar → FALHA.
- [ ] **Passo 3:** implementar com `size: 100` (paginação fica fora do escopo de hoje). A pré-visualização abre `/${code}` numa aba nova, com um `title` no botão avisando que "a pré-visualização conta como uma viagem".
- [ ] **Passo 4:** remover de `Dashboard.test.tsx` os testes `filtra os portais por status` e `copia o link da Nebulosa…`, agora cobertos aqui. `npm test` → PASSA.
- [ ] **Passo 5:** commit `feat(frontend): Meus portais com dados da API`

### I3.3: Pausar, retomar e fechar portal

**Arquivos:** modificar `frontend/src/app/sections/PortalsSection.tsx` e o teste dele.

**Interfaces:** consome `api.updateLink` e `api.closeLink`.

- [ ] **Passo 1: testes que falham:**
  - `pausar chama PATCH e recarrega`: no card ativo, "Pausar" chama `api.updateLink(code, { paused: true })` e depois `listLinks` de novo.
  - `retomar`: no card pausado, "Retomar" chama `{ paused: false }`.
  - `fechar pede confirmação inline`: "Fechar" mostra "Fechar de vez? O link para de funcionar." com "Confirmar" e "Cancelar". "Confirmar" chama `api.closeLink(code)`. **Não usar `window.confirm`.**
  - `card fechado não tem ações`.
  - `erro da ação aparece no card`: um `ApiError` na ação mostra a `message` num `role="alert"` dentro do card.
- [ ] **Passo 2:** rodar → FALHA. **Passo 3:** implementar. **Passo 4:** rodar → PASSA.
- [ ] **Passo 5:** commit `feat(frontend): pausar, retomar e fechar portais`

### I3.4: Viagens com dados reais

> **Como ficou:** `components/TravelsSection.tsx`. Gráfico de 30 dias no lugar do mapa de planetas, ranking de países com `Intl.DisplayNames` e 3 cards.

**Arquivos:** criar `frontend/src/app/sections/TravelsSection.tsx` e `frontend/src/app/sections/TravelsSection.test.tsx`. Modificar `frontend/src/app/Dashboard.tsx` (bloco `active === "Viagens"`).

**Interfaces:**
- Consome: `api.dashboardSummary(30)`, `api.dashboardTravels(30)`, `api.countries()`, `formatNumber` e `formatPct`.
- Produz: `export default function TravelsSection()`.

- [ ] **Passo 1: testes que falham:**
  - `cards`: "VIAGENS TOTAIS" = `totalTravels` com `formatPct(travelsChangePct)` + " nos últimos 30 dias", "VIAGENS NO PERÍODO" = soma da série e "PAÍSES ALCANÇADOS" = `countries.length`. Os cards "VIAJANTES ÚNICOS" e "TEMPO ATÉ O DESTINO" **não** aparecem.
  - `gráfico com 30 pontos`.
  - `ranking de países usa nomes em português`: `[{ country: "BR", travels: 3 }, { country: "US", travels: 1 }]` mostra "Brasil" e "Estados Unidos" (via `new Intl.DisplayNames(["pt-BR"], { type: "region" })`), com largura da barra proporcional.
  - `sem país mostra estado vazio` (Foco #5): `[]` mostra "Ainda sem dados de país — a localização das viagens chega em breve." e não aparece o mapa com planetas mockados.
- [ ] **Passo 2:** FALHA. **Passo 3:** implementar. **Passo 4:** PASSA.
- [ ] **Passo 5:** commit `feat(frontend): Viagens com dados reais`

### I3.5: Proteção com dados reais

> **Como ficou:** `components/ProtectionSection.tsx`. Sem o bloco do índice: cards de ameaças e destinos verificados, 3º card com a quebra por motivo, e histórico com estado vazio.

**Arquivos:** criar `frontend/src/app/sections/ProtectionSection.tsx` e `frontend/src/app/sections/ProtectionSection.test.tsx`. Modificar `frontend/src/app/Dashboard.tsx` (bloco `active === "Proteção"`).

**Interfaces:**
- Consome: `api.protectionSummary()`, `api.protectionEvents(20)` e `relativeTime`.
- Produz: `export default function ProtectionSection()` e `export const REASON_LABELS: Record<BlockedReason, string>`:
  `INVALID_URL: "Destino inválido recusado"`, `SELF_LOOP: "Loop para a própria Lumi"`, `RESERVED_ALIAS: "Nome reservado recusado"`, `PAUSED: "Viagem em portal pausado"`, `CLOSED: "Viagem em portal fechado"`, `RATE_LIMIT: "Excesso de tentativas bloqueado"`.

- [ ] **Passo 1: testes que falham:**
  - `cards`: "AMEAÇAS BLOQUEADAS" = `blockedThreats` e "DESTINOS VERIFICADOS" = `verifiedDestinations`. "ÍNDICE DE PROTEÇÃO" e "TRÁFEGO FILTRADO" **não** aparecem.
  - `quebra por motivo`: uma linha por chave de `byReason`, com o rótulo de `REASON_LABELS` e a contagem.
  - `histórico`: cada evento mostra o rótulo, o `code` (ou "—") e `relativeTime(occurredAt)`.
  - `sem eventos mostra estado vazio`: "Nenhuma ameaça até agora. A Lumi segue de vigia."
- [ ] **Passo 2:** FALHA. **Passo 3:** implementar. **Passo 4:** PASSA.
- [ ] **Passo 5:** commit `feat(frontend): Proteção com dados reais`

### I5.1: Estatísticas por portal (opcional, só se sobrar tempo)

**Arquivos:** modificar `frontend/src/app/sections/PortalsSection.tsx` e o teste dele.

**Interfaces:** consome `api.linkStats(code, 12)`.

- [ ] **Passo 1:** teste `ver estatísticas expande humanos e robôs`: o botão "Estatísticas" no card chama `api.linkStats(code, 12)` e mostra "Humanos: 2" e "Robôs: 1".
- [ ] **Passo 2:** FALHA. **Passo 3:** implementar um painel expansível no card. **Passo 4:** PASSA.
- [ ] **Passo 5:** commit `feat(frontend): estatísticas por portal`

### I4.1: Limpeza, roteiro manual e README

**Arquivos:** modificar `frontend/src/app/Dashboard.tsx` e `README.md`. Criar `docs/integracao/roteiro-manual.md`.

- [ ] **Passo 1:** `grep -rn "l2.to\|lumi-session\|Nebulosa\|Ana Martins" frontend/src --include=*.tsx --include=*.ts | grep -v test`. A única ocorrência aceitável é em Conquistas/Configurações (mock, decisão 1). Remover as outras.
- [ ] **Passo 2:** `docs/integracao/roteiro-manual.md` com pré-requisitos (os comandos da I0.2) e estes passos, cada um com o resultado esperado: (1) criar conta, (2) sair e entrar de novo, (3) criar portal com alias, (4) copiar e abrir o link curto em aba anônima → Travessia, (5) voltar ao dashboard e ver a viagem contada, (6) pausar → a Travessia mostra pausado, (7) a Proteção mostra o evento, (8) retomar e fechar → a Travessia mostra fechado, (9) tentar alias `api` → recusado, (10) `/dashboard` em aba anônima → vai para `/login`.
- [ ] **Passo 3:** no `README.md`, seção **"Rodando integrado e E2E"**: o proxy `/api` e `/r` do Vite, o link curto `/{code}` caindo na Travessia, como rodar `npm run e2e` (com `docker compose up -d db` antes) e o link para o roteiro manual.
- [ ] **Passo 3b:** pendências que ficaram das tasks anteriores:
  - listener de `lumi:unauthorized` no `App.tsx` (I1.1, Foco de revisão #1), com teste;
  - título "Olá, Ana" vindo do `user.name` (I1.4);
  - CSS sem uso depois da I3.4/I3.5: `.cosmic-map`, `.map-*`, `.planet-*`, `.travel-streak`, `.streak-*`, `.shield-score`, `.shield-rings`, `.security-bars`;
  - unificar `auth.ts`, `links.ts`, `travel.ts` e `dashboard.ts` no `lumi.ts` (opcional);
  - prefixo `{location.host}/` no campo de alias (I1.6), se a `fix/i1.6-prefixo-alias` não tiver entrado antes.
- [ ] **Passo 4:** commit `docs: roteiro de teste manual e como rodar a integração`

### I4.2: Verificação final e PR

- [ ] **Passo 1:** `cd frontend && npm run format:check && npm run typecheck && npm test && npm run build`. Tudo verde.
- [ ] **Passo 2:** `cd backend && ./mvnw -B verify`. Verde.
- [ ] **Passo 3:** `docker compose up -d db && cd frontend && npm run e2e`. Tudo verde.
- [ ] **Passo 4:** seguir o roteiro manual uma vez no navegador.
- [ ] **Passo 5:** abrir uma issue ou nota no PR da I4.1 listando o "fora do escopo" (I5.x): nginx/gitops, job de E2E no CI, Conquistas/Configurações.

---

## Fora do escopo de hoje

- `location /api/` e `/r/` no nginx do front, Ingress e gitops.
- Job de E2E no GitHub Actions (precisa de Postgres de serviço + Java + Node no mesmo job, fica para depois).
- Back para Conquistas e Configurações.
