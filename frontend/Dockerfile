# syntax=docker/dockerfile:1
# Contexto de build: frontend/
# Os PNGs vem do Git LFS: o checkout do CI precisa de "lfs: true".

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# "build" roda tsc --noEmit e depois vite build.
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Escuta na 8080 (sem root). O Deployment monta um emptyDir em /tmp (pid e cache do nginx).
USER 1001
EXPOSE 8080
