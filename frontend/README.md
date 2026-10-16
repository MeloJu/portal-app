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

- Integrar a API do VirusTotal (análise de URLs).
- Substituir o link externo do Bypass City por um bypass de encurtadores próprio (rota "Fechar portal").
- Trocar os dados mockados (portais, métricas, login) pela API do backend.

## Docker

Imagem em dois estágios: `node:22` faz o build (`npm run build`, que inclui o `tsc`) e o `nginx-unprivileged` serve o `dist` sem root, na porta **8080**.

```bash
docker build -t lumi-frontend ./frontend
docker run -p 8080:8080 -e TOOLS_API_URL=http://tools-api:3001 lumi-frontend
```

- `TOOLS_API_URL`: para onde o nginx repassa `/tools/*` (o mesmo papel do proxy do Vite). Padrão `http://tools-api:3001`, o nome do serviço no Docker/Kubernetes.
- Rotas do app (`/login`, `/dashboard`, `/r/:slug`) caem no `index.html`; `/assets/*` têm cache permanente (nomes com hash) e o `index.html` vai sem cache.
- `GET /healthz` responde `ok`, para probe do Kubernetes.
- As imagens estão no Git LFS: rode `git lfs pull` antes do build, senão a imagem leva os ponteiros no lugar dos PNG.
- Configuração do nginx em `docker/default.conf.template`.
