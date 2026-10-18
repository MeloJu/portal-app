/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    port: 5173,
    // Chaves com a barra final: em string o Vite casa por prefixo, e "/r" levaria /rocket (um portal) ao backend.
    proxy: {
      "/tools/": "http://localhost:3001",
      // API Spring (scripts/dev-backend*). Mesma origem: o cookie de sessão funciona sem CORS.
      "/api/": "http://localhost:8080",
      // Redirect 302 direto do backend (robôs e teste de carga). A Travessia do front fica em /{code}.
      "/r/": "http://localhost:8080",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
