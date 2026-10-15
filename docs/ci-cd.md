# CI/CD

```
feature/* ──PR──► develop ──PR──► main
   │                │              │
   ▼                ▼              ▼
  ci.yml          ci.yml      ci.yml + release.yml
 (testes)        (testes)    (imagem → GHCR → tag no portal-gitops → ArgoCD)
```

Merge em `main` é deploy. Ninguém roda `kubectl` na mão: o ArgoCD sincroniza o
[portal-gitops](https://github.com/MeloJu/portal-gitops).

## Workflows

| Arquivo | Quando | O que faz |
| --- | --- | --- |
| `ci.yml` | push e PR em `main`/`develop` | testes do frontend, backend e tools-api; build das três imagens; smoke test das imagens; hadolint; gitleaks |
| `release.yml` | push em `main` | build, Trivy (barra CRITICAL com correção), push no GHCR com a tag = 7 primeiros caracteres do SHA, depois commita a tag em `lumi/overlays/prod/kustomization.yaml` do portal-gitops |

O job `bump` só roda se as três imagens foram publicadas, então o portal-gitops nunca aponta
para uma tag que não existe.

## Configuração única

1. **Secret `GITOPS_TOKEN`** neste repositório (Settings → Secrets and variables → Actions).
   É um PAT fine-grained com acesso **só ao `portal-gitops`** e a permissão **Contents: Read and
   write**. O `GITHUB_TOKEN` padrão não escreve em outro repositório.
2. **Visibilidade dos pacotes no GHCR.** Na primeira publicação os pacotes
   `portal-app-backend`, `portal-app-frontend` e `portal-app-tools-api` nascem privados. Deixe
   públicos (Package settings → Change visibility) ou crie um `imagePullSecret` no cluster.
3. **Proteção da `main`** (recomendado): exigir PR e os jobs do `ci.yml` verdes.

## Rodar o smoke test das imagens localmente

```bash
docker build -t lumi-backend:test backend
docker build -t lumi-frontend:test frontend
docker build -t lumi-tools-api:test tools-api
scripts/smoke-images.sh
```

O script sobe as imagens com as mesmas restrições do Deployment (uid 1001, filesystem somente
leitura, sem capabilities) e confere CSP, `nosniff`, `Referrer-Policy: no-referrer` na
Travessia (`/r/`), cache dos assets, fallback da SPA e `/tools/health`.
