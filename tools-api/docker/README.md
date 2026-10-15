# Docker do tools-api

Imagem baseada em `mcr.microsoft.com/playwright:v1.49.1-noble` (traz o Chromium). A tag precisa ser a mesma
versão do `playwright-core` no `package-lock.json`.

## Construir e rodar

```bash
docker build -t lumi-tools-api ./tools-api
docker run -p 3001:3001 \
  --security-opt seccomp=tools-api/docker/seccomp_profile.json \
  -e VT_API_KEY=... \
  -e BROWSER_RESOLVER=on \
  -e "BYPASS_API_URL=https://trw.lat/api/bypass?url={url}" \
  lumi-tools-api
```

As chaves entram por variável de ambiente (ou Secret no Kubernetes), nunca na imagem. O `.env` fica fora (`.dockerignore`).

## Por que o `seccomp_profile.json`

O navegador headless abre páginas de anúncio (conteúdo hostil), então o sandbox do Chromium fica **ligado**
(`chromiumSandbox: true`; desligar só com `BROWSER_SANDBOX=off`). O Playwright, por padrão, abre o Chromium com
`--no-sandbox`, e com o perfil de seccomp padrão do Docker o sandbox não consegue iniciar
("Chromium sandboxing failed"). O perfil desta pasta é o publicado pela Microsoft para esse caso
(<https://github.com/microsoft/playwright/blob/v1.49.1/utils/docker/seccomp_profile.json>, Apache-2.0).

O container roda como `pwuser` (sem root) e sem capabilities extras. Sem o navegador (`BROWSER_RESOLVER` desligado)
o perfil não é necessário.

## Kubernetes

O padrão `RuntimeDefault` do pod tem o mesmo problema do perfil padrão do Docker. É preciso um
`securityContext.seccompProfile` do tipo `Localhost` apontando para este arquivo (instalado nos nós) ou deixar
o navegador desligado no cluster. Não usar `--no-sandbox` sem decidir isso conscientemente.
