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

test("shows the logo at the top of the home screen", async ({ page }) => {
  await page.goto("/");
  const logo = page.getByRole("img", { name: "Fixa" });
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(
    true,
  );
});

test("opens the settings from the home screen", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Ajustes" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ajustes" })).toBeVisible();
});

test("exposes an installable web app manifest", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  const manifest = await (await request.get(href as string)).json();
  expect(manifest).toMatchObject({ name: "Fixa", lang: "pt-BR", display: "standalone" });
});

test("has a full-bleed maskable icon for Android's round and squircle masks", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await request.get(href as string)).json();
  const maskable = manifest.icons.filter((i: { purpose?: string }) => i.purpose === "maskable");
  expect(maskable).toEqual([
    { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ]);
  const cornerAlpha = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, 1, 1).data[3];
  }, "/pwa-maskable-512.png");
  expect(cornerAlpha).toBe(255);
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
