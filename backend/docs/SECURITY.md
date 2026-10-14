# Segurança

Decisões de segurança do projeto, o porquê de cada uma e os riscos que escolhemos aceitar.
Última revisão: 2026-10-14.

Nem tudo aqui é back-end. A coluna **Onde** indica quem implementa: `api`, `front`, `gitops`
(manifests do K8s) ou `ci`.

---

## 1. Autorização: todo acesso é por dono

| Onde | Status |
| --- | --- |
| `api` | decidido |

Nas rotas, **sempre** `findByCodeAndOwnerId(code, userId)` — nunca `findByCode`.

Link de outro usuário responde **404, não 403**. O 403 confirmaria que o código existe,
e isso já é informação.

Esse é o bug clássico de API (IDOR, o primeiro do OWASP API Top 10), então ele tem teste
de integração dedicado, não só revisão de código:

> usuário B tenta `PATCH` no link do A → 404

## 2. Destino só `http` / `https`

| Onde | Status |
| --- | --- |
| `api` + `front` | decidido |

Isso deixa de ser validação e vira segurança: a Travessia faz `window.location = targetUrl`,
e um `targetUrl` com `javascript:alert(document.cookie)` vira XSS no nosso domínio.

Validação em dois lugares, de propósito:

- o back valida na criação **e** no `PATCH`;
- o front confere o esquema de novo antes de redirecionar.

## 3. Senhas e login

| Onde | Status |
| --- | --- |
| `api` | decidido |

- Hash com **BCrypt**.
- Mínimo de 8 caracteres.
- O login responde **sempre a mesma mensagem genérica** — "e-mail ou senha inválidos" —
  independente de o e-mail existir ou a senha estar errada.

## 4. Sessão: JWT em cookie, 8h, sem refresh

| Onde | Status |
| --- | --- |
| `api` | decidido |

JWT guardado em **cookie**, expiração de **8 horas**, **sem refresh token**. A escolha é por
custo de implementação: 8h cobre o uso esperado e refresh token é complexidade que não cabe
no escopo.

**Decidido (Q47/Q48):** cookie `lumi_session` com `HttpOnly`, `Secure` e
`SameSite=Strict`, `Max-Age` de 28800 s (8 h), sem refresh token, mais
`POST /api/auth/logout`.

O porquê de cada flag:

- `HttpOnly` — sem ele, o cookie perde a principal vantagem sobre o `localStorage`: um XSS
  no front leria o token.
- `SameSite=Strict` — autenticação por cookie reabre CSRF, e `Strict` resolve no nosso caso
  porque front e API são mesma origem via Ingress. **É por isso que o CSRF do Spring fica
  desabilitado** — é a decisão, não esquecimento.
- `Secure` — em desenvolvimento o Vite faz proxy para `localhost`, onde o navegador aceita
  cookie `Secure` mesmo em `http`.
- `POST /api/auth/logout` — o front não consegue apagar um cookie `HttpOnly`, então encerrar
  a sessão precisa de rota própria, que responde `Max-Age=0`.

O contrato (`docs/openapi.yaml`) acompanha: `cookieAuth` em vez de `bearerAuth`, e o
`AuthResponse` não devolve mais `accessToken` no corpo.

## 5. Segredos fora do Git

| Onde | Status |
| --- | --- |
| `api` + `gitops` + `ci` | decidido |

- `JWT_SECRET` com **no mínimo 256 bits** (`openssl rand -base64 32`).
- Senha do banco via **Secret do K8s**, com Sealed Secrets no gitops.
- **gitleaks no CI**, para barrar segredo commitado por acidente.
- **Validação na subida:** se `JWT_SECRET` estiver ausente ou curto, a app **falha ao iniciar**.
  O modo de falha que queremos evitar é rodar em produção com um default de desenvolvimento.

## 6. Limites de tamanho

| Onde | Status |
| --- | --- |
| `api` | decidido |

- URL: até **2048** caracteres.
- Título: até **120**.
- Alias: segue o **regex do contrato**.
- Body grande é rejeitado.

## 7. Actuator fora da internet

| Onde | Status |
| --- | --- |
| `api` + `gitops` | decidido |

`management.server.port=8081`. O Ingress só roteia a **8080**; as probes e o Prometheus
acessam a **8081** por dentro do cluster.

Sem isso, `/actuator/prometheus` fica público.

## 8. Nada sensível em log ou trace

| Onde | Status |
| --- | --- |
| `api` | decidido |

- Não logar body de `/api/auth/**`.
- O agente OTel não captura o header `Authorization` por padrão — manter assim (ou seja:
  ninguém adiciona isso a uma allowlist de headers "pra debugar").

## 9. Usuário do banco sem superuser

| Onde | Status |
| --- | --- |
| `gitops` | decidido |

O CloudNativePG já cria um owner próprio da database; a app usa esse, não o superuser.

## 10. Container

| Onde | Status |
| --- | --- |
| `ci` + `gitops` | decidido |

- Roda como **não-root**: `USER 1001` no Dockerfile.
- `readOnlyRootFilesystem` no Deployment.
- **Trivy no CI** escaneando a imagem. Barato de configurar e conta ponto no pipeline.

## 11. Rate limit em duas camadas

| Onde | Status |
| --- | --- |
| `api` + `gitops` | decidido |

Rotas que precisam, no mínimo:

- `/api/auth/login` — força bruta;
- `/api/auth/register` — força bruta e criação em massa;
- `/api/travel` — inflar contagem.

Duas opções, com trade-off diferente:

**(a) No Ingress** — middleware `RateLimit` do Traefik, que já vem no K3s. É config pura no
gitops. Só que a requisição barrada nunca chega na API, então **não vira "Ameaça bloqueada"
no painel**.

**(b) Na app** — Bucket4j, em memória, por IP. Conta como `RATE_LIMIT` no painel e no
Prometheus. Para pegar o IP real atrás do Traefik precisa de
`server.forward-headers-strategy=native`. O IP é usado **só em memória, nunca gravado**.

➡️ **Decisão: os dois, em camadas.** Traefik com um limite alto e grosseiro (proteção do
cluster) e a app com o limite fino que alimenta a Lumi. Isso vira um slide de "defesa em
profundidade".

➡️ **Se o tempo apertar, fica só o (b)** — é o que alimenta o painel.

## 12. CORS: nenhum

| Onde | Status |
| --- | --- |
| `api` + `front` | decidido |

Em produção não há CORS porque é mesma origem, via Ingress. Em desenvolvimento, o Vite usa
`server.proxy` para `/api` → `localhost:8080`, então também não precisa.

Nada de `allowedOrigins("*")` "só pra funcionar".

## 13. Cabeçalhos de resposta

| Onde | Status |
| --- | --- |
| `api` + `front` | decidido (front precisa ser avisado) |

A API fica com os **defaults do Spring Security**: `X-Content-Type-Options`,
`X-Frame-Options`, HSTS.

O nginx do front ganha:

- uma **CSP restritiva**: `default-src 'self'`, `connect-src 'self'`;
- **`Referrer-Policy: no-referrer` na Travessia**, para não vazar o código curto para o site
  de destino.

⚠️ Isso é trabalho do pessoal do front — **alguém precisa avisá-los**.

---

## Riscos conhecidos e aceitos

### Enumeração de usuários no cadastro

Hoje o contrato responde **409 "E-mail já cadastrado"**, o que permite descobrir quem tem
conta.

**Decisão: aceitar o risco.** Resolver direito exigiria confirmação por e-mail (SMTP,
templates), que está fora do escopo.

**Mitigação parcial:** rate limit em `/api/auth/register` (seção 11), que encarece a
varredura em massa.

Saber o risco e decidir aceitá-lo conscientemente também é postura de segurança — o que não
queremos é descobrir isso depois.
