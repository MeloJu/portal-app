import { expect, test } from "@playwright/test";
import { createLinkViaApi, registerViaApi } from "./helpers";

test("Achievements reflect the signed-in user's real portal and travel data", async ({ page }) => {
  await registerViaApi(page);
  const { code } = await createLinkViaApi(page, { targetUrl: "https://example.com/achievement" });

  const travel = await page.request.get(`/api/travel/${code}`);
  expect(travel.status(), await travel.text()).toBe(200);

  await page.goto("/dashboard");
  await page
    .getByRole("navigation", { name: /navegação principal/i })
    .getByRole("button", { name: "Conquistas" })
    .click();

  const firstPortal = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Primeiro portal" }) });
  await expect(firstPortal.getByText("CONQUISTADA")).toBeVisible();

  const firstTravel = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Primeiro clique" }) });
  await expect(firstTravel.getByText("CONQUISTADA")).toBeVisible();

  const popularRoute = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Rota popular" }) });
  await expect(popularRoute).toContainText("1 de 100 viagens em um portal");
  await expect(popularRoute).toHaveClass(/locked/);

  await expect(page.getByText(/Nenhum país foi identificado.*GeoIP/i)).toBeVisible();
});
