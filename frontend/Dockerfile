# Build do app (Vite) num estágio e só os arquivos estáticos na imagem final.
FROM node:22.12.0-alpine AS build

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# nginx sem root (porta 8080). Serve o dist, repassa /tools para o tools-api e /api e /r para o backend.
# 1.29 (mainline): a 1.28 ainda vinha com OpenSSL 3.5.5, CRITICAL no Trivy (CVE-2026-31789,
# corrigido na 3.5.6). O CI barra a publicação enquanto houver CRITICAL com correção disponível.
FROM nginxinc/nginx-unprivileged:1.29-alpine

# Endereço do tools-api visto de dentro do container (no Kubernetes, o Service).
ENV TOOLS_API_URL=http://tools-api:3001
# Endereço do backend Spring visto de dentro do container (no Kubernetes, o Service).
ENV API_URL=http://backend:8080

COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /build/dist /usr/share/nginx/html

EXPOSE 8080
