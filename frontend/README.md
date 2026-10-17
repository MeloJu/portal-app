# Lumi Links — Frontend

React 19 + Vite + Tailwind v4 + React Router 7. Testes com Vitest + Testing Library.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento (http://localhost:5173) |
| `npm run build` | typecheck + build de produção |
| `npm test` | roda os testes uma vez |
| `npm run test:watch` | testes em modo watch |

## Estrutura

- `src/app/` — App, rotas, Dashboard e páginas (`pages/`)
- `src/assets/` — imagens usadas pelo app
- `assets/` — imagens de referência (mascote e logos), fora do bundle
- `src/test/setup.ts` — setup global dos testes


## Pendências (próximas etapas)

- Conquistas e Configurações continuam com dados de exemplo: ainda não existem rotas no backend para elas.

Como rodar o front integrado à API e os testes E2E: seção "Rodando integrado e E2E" do [README da raiz](../README.md#rodando-integrado-e-e2e).

## Docker

Imagem em dois estágios: `node:22` faz o build (`npm run build`, que inclui o `tsc`) e o `nginx-unprivileged` serve o `dist` sem root, na porta **8080**.

```bash
docker build -t lumi-frontend ./frontend
docker run -p 8080:8080 -e TOOLS_API_URL=http://tools-api:3001 -e API_URL=http://backend:8080 lumi-frontend
```

- `TOOLS_API_URL`: para onde o nginx repassa `/tools/*` (o mesmo papel do proxy do Vite). Padrão `http://tools-api:3001`, o nome do serviço no Docker/Kubernetes.
- `API_URL`: para onde o nginx repassa `/api/*` e `/r/*` (o backend Spring). Padrão `http://backend:8080`. Com a API na mesma origem do app, o cookie de sessão funciona sem CORS.
- Rotas do app (`/login`, `/dashboard` e o link curto `/{code}`, que abre a Travessia) caem no `index.html`; `/assets/*` têm cache permanente (nomes com hash) e o `index.html` vai sem cache.
- `GET /healthz` responde `ok`, para probe do Kubernetes.
- As imagens estão no Git LFS: rode `git lfs pull` antes do build, senão a imagem leva os ponteiros no lugar dos PNG.
- Configuração do nginx em `docker/default.conf.template`.
