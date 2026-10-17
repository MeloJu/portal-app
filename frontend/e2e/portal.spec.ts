import { expect, test, type Page } from "@playwright/test";
import { createLinkViaApi, registerViaApi } from "./helpers";

function uniqueAlias(): string {
  return `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

async function createPortalOnScreen(page: Page, targetUrl: string, alias?: string) {
  await page.getByPlaceholder("Cole seu link longo aqui...").fill(targetUrl);
  if (alias) await page.getByPlaceholder("personalizar").fill(alias);
  await page.getByRole("button", { name: "Criar portal" }).click();
}

test.beforeEach(async ({ page }) => {
  await registerViaApi(page);
});

test("cria portal pela tela e a Travessia leva ao destino", async ({ page }) => {
  const alias = uniqueAlias();
  await page.goto("/dashboard");
  await createPortalOnScreen(page, "https://example.com/destino", alias);

  await expect(page.locator(".created-link")).toContainText(`localhost:5173/${alias}`);

  await page.goto(`/${alias}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("example.com");
  await expect(page.getByRole("link", { name: "Sim, prosseguir" })).toHaveAttribute(
    "href",
    "https://example.com/destino",
  );
});

test("uma visita à Travessia conta uma viagem só", async ({ page }) => {
  const { code } = await createLinkViaApi(page, { targetUrl: "https://example.com/contagem" });

  await page.goto(`/${code}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("example.com");

  const res = await page.request.get(`/api/links/${code}`);
  expect(res.status()).toBe(200);
  expect((await res.json()).travelCount).toBe(1);
});

test("portal pausado mostra aviso", async ({ page }) => {
  const { code } = await createLinkViaApi(page, { targetUrl: "https://example.com/pausado" });
  const res = await page.request.patch(`/api/links/${code}`, { data: { paused: true } });
  expect(res.status()).toBe(200);

  await page.goto(`/${code}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Este portal está pausado.");
  await expect(page.getByRole("link", { name: "Sim, prosseguir" })).toHaveCount(0);
});

test("alias reservado é recusado na tela", async ({ page }) => {
  await page.goto("/dashboard");
  await createPortalOnScreen(page, "https://example.com/reservado", "dashboard");

  await expect(page.getByRole("alert")).toHaveText("Esse nome de portal é reservado");
});

test("link para o próprio domínio é recusado", async ({ page }) => {
  await page.goto("/dashboard");
  await createPortalOnScreen(page, "http://localhost:5173/x");

  await expect(page.getByRole("alert")).toHaveText("Esse endereço aponta para o próprio Lumi Links");
});
