# Lumi Links — Frontend (portal-app)

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

## Gitflow

`main` (produção) ← `develop` (integração) ← `feature/*`. Hotfixes saem de `main`, releases de `develop`.
Os PNGs são versionados com Git LFS (`git lfs install` antes do primeiro clone/commit).

## Pendências (próximas etapas)

- Integrar a API do VirusTotal (análise de URLs).
- Substituir o link externo do Bypass City por um bypass de encurtadores próprio (rota "Fechar portal").
- Trocar os dados mockados (portais, métricas, login) pela API do backend.
