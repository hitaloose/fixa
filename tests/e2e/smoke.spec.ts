import { expect, test } from "@playwright/test";

test("shows the decks screen with the bottom navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Baralhos" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  await expect(nav.getByRole("link")).toHaveText([
    "Baralhos",
    "Navegar",
    "Adicionar",
    "Estatísticas",
  ]);
  await expect(nav.getByRole("link", { name: "Baralhos" })).toHaveAttribute("aria-current", "page");
});

test("navigates between tabs", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Estatísticas" }).click();
  await expect(page).toHaveURL(/\/stats$/);
  await expect(page.getByRole("heading", { name: "Estatísticas" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Estatísticas" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("touch targets in the navigation are at least 44px tall", async ({ page }) => {
  await page.goto("/");
  for (const link of await page.getByRole("navigation").getByRole("link").all()) {
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test("exposes an installable web app manifest", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  const manifest = await (await request.get(href as string)).json();
  expect(manifest).toMatchObject({ name: "Fixa", lang: "pt-BR", display: "standalone" });
});

test("works offline after the first visit", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // let the active service worker control the page
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Baralhos" })).toBeVisible();
  await page.getByRole("link", { name: "Adicionar" }).click();
  await expect(page.getByRole("heading", { name: "Adicionar" })).toBeVisible();
});
