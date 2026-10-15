# syntax=docker/dockerfile:1
# Contexto de build: tools-api/

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Sem build: o Node 22 remove os tipos em tempo de execucao (tsconfig usa erasableSyntaxOnly).
COPY src ./src

# Nao-root (SECURITY.md secao 10).
USER 1001
EXPOSE 3001
CMD ["node", "--experimental-strip-types", "--disable-warning=ExperimentalWarning", "src/server.ts"]
