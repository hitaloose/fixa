import { expect, test } from "@playwright/test";

test("switches the interface to English and keeps it across reloads", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await page.getByRole("radiogroup", { name: "Idioma" }).getByText("English").click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await page.goto("/settings");
  await page.getByRole("radiogroup", { name: "Language" }).getByText("Português (Brasil)").click();
  await expect(page.getByRole("heading", { name: "Ajustes" })).toBeVisible();
});
