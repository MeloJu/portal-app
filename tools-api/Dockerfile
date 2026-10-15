# Imagem oficial do Playwright: já traz o Chromium e as bibliotecas do Linux.
# A versão da tag precisa ser a mesma do playwright-core no package-lock.json (1.49.1).
FROM mcr.microsoft.com/playwright:v1.49.1-noble

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    # No container não há Edge: usa o Chromium da imagem.
    BROWSER_CHANNEL=chromium

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

# Sem root: é isso que deixa o sandbox do Chromium ligado (páginas de anúncio são conteúdo hostil).
USER pwuser

EXPOSE 3001
# As chaves (VT_API_KEY, BYPASS_API_URL...) entram por variável de ambiente ou Secret, nunca na imagem.
CMD ["node", "--experimental-strip-types", "src/server.ts"]
