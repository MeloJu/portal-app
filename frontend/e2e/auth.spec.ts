import { expect, test } from "@playwright/test";
import { registerViaApi, uniqueEmail } from "./helpers";

test("cadastro pela tela leva ao dashboard com o nome do usuário", async ({ page }) => {
  const name = "Bia Navegante";
  await page.goto("/login");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByPlaceholder("Como podemos te chamar?").fill(name);
  await page.getByPlaceholder("voce@estacao.com").fill(uniqueEmail());
  await page.getByPlaceholder("Pelo menos 8 caracteres").fill("senha-forte-e2e");
  await page.getByRole("button", { name: "Criar minha estação" }).click();

  await expect(page).toHaveURL("/dashboard");
  await expect(page.locator(".profile")).toContainText(name);
});

test("login com senha errada mostra erro genérico", async ({ page, context }) => {
  const { email } = await registerViaApi(page);
  await context.clearCookies();

  await page.goto("/login");
  await page.getByPlaceholder("voce@estacao.com").fill(email);
  await page.getByPlaceholder("Digite sua senha").fill("senha-errada-123");
  await page.getByRole("button", { name: "Entrar na estação" }).click();

  await expect(page.getByRole("alert")).toHaveText("E-mail ou senha não conferem. Confira e tente de novo.");
  await expect(page).toHaveURL("/login");
});

test("sem sessão, /dashboard manda para /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/login");
});

test("sair encerra a sessão", async ({ page }) => {
  await registerViaApi(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/dashboard");

  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page).toHaveURL("/login");

  await page.goto("/dashboard");
  await expect(page).toHaveURL("/login");
});
