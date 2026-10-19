import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

const mavenWrapper = process.platform === "win32" ? ".\\mvnw.cmd" : "./mvnw";

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `${mavenWrapper} -q spring-boot:run`,
      cwd: "../backend",
      url: "http://localhost:8081/actuator/health",
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        DB_URL: "jdbc:postgresql://localhost:5432/lumi",
        DB_USER: "lumi",
        DB_PASSWORD: "lumi",
        PUBLIC_BASE_URL: "http://localhost:5173",
        SESSION_COOKIE_SECURE: "false",
        APP_RATELIMIT_ENABLED: "false",
        JWT_SECRET: randomBytes(32).toString("base64"),
        APP_CODE_PEPPER: randomBytes(32).toString("base64"),
      },
    },
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: false,
    },
  ],
});
