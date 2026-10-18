# Imagem oficial do Playwright: já traz o Chromium e as bibliotecas do Linux.
# A versão da tag precisa ser a mesma do playwright-core no package-lock.json (1.49.1).
FROM mcr.microsoft.com/playwright:v1.49.1-noble

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    # No container não há Edge: usa o Chromium da imagem.
    BROWSER_CHANNEL=chromium

COPY package.json package-lock.json ./
# Depois de instalar as dependências o npm não serve para mais nada: a app sobe com `node`.
# O npm global da imagem base traz o pacote `tar` com CRITICAL no Trivy (CVE-2026-59873);
# removê-lo tira a vulnerabilidade e diminui a superfície de ataque.
RUN npm ci --omit=dev \
 && rm -rf /usr/lib/node_modules/npm /usr/bin/npm /usr/bin/npx

COPY src ./src

# Sem root: é isso que deixa o sandbox do Chromium ligado (páginas de anúncio são conteúdo hostil).
USER pwuser

EXPOSE 3001
# As chaves (VT_API_KEY, BYPASS_API_URL...) entram por variável de ambiente ou Secret, nunca na imagem.
CMD ["node", "--experimental-strip-types", "src/server.ts"]
