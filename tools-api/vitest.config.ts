import { defineConfig } from "vitest/config";

export default defineConfig({
  // Testes nunca chamam o serviço de bypass real nem abrem navegador, mesmo com a chave no ambiente.
  test: { environment: "node", include: ["src/**/*.test.ts"], env: { BYPASS_API_URL: "", BYPASS_API_KEY: "", BROWSER_RESOLVER: "" } },
});
