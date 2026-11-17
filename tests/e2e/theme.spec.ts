import { expect, test } from "@playwright/test";

const background = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("follows the device's dark mode by default", async ({ browser }) => {
  const page = await (await browser.newContext({ colorScheme: "dark" })).newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background(page)).toBe("rgb(17, 18, 21)");
});

test("keeps the theme chosen in settings across reloads", async ({ browser }) => {
  const page = await (await browser.newContext({ colorScheme: "light" })).newPage();
  await page.goto("/settings");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("radiogroup", { name: "Tema" }).getByText("Escuro").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background(page)).toBe("rgb(17, 18, 21)");
});
