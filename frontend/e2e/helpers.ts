import { expect, type Page } from "@playwright/test";

export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export async function registerViaApi(
  page: Page,
  name = "Exploradora E2E",
): Promise<{ email: string; password: string }> {
  const email = uniqueEmail();
  const password = "senha-forte-e2e";
  const res = await page.request.post("/api/auth/register", { data: { name, email, password } });
  expect(res.status(), await res.text()).toBe(201);
  return { email, password };
}

export async function createLinkViaApi(
  page: Page,
  input: { targetUrl: string; alias?: string; title?: string },
): Promise<{ code: string; shortUrl: string }> {
  const res = await page.request.post("/api/links", { data: input });
  expect(res.status(), await res.text()).toBe(201);
  const { code, shortUrl } = await res.json();
  return { code, shortUrl };
}
