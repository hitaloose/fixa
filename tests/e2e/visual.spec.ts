import { expect, test } from "@playwright/test";

/**
 * Visual snapshot of a card with a fraction, a root and a matrix at 390px (docs/07 › Testes).
 * Baselines are per platform (font rasterisation differs); refresh after an intended change with
 * `pnpm test:e2e --update-snapshots` and review the diff.
 */
test("renders fraction, root and matrix on a card at phone width", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Novo baralho" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo baralho" });
  await dialog.getByRole("textbox", { name: "Nome" }).fill("Álgebra");
  await dialog.getByRole("button", { name: "Criar" }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/add");
  await page.getByRole("textbox", { name: "Frente" }).click();
  await page.keyboard.type("Fórmulas");
  await page.getByRole("textbox", { name: "Verso" }).click();
  await page.keyboard.insertText(
    "\\(\\frac{a}{b}\\) e \\(\\sqrt{x^2+1}\\) \\[\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}\\]",
  );
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Nota adicionada.");

  await page.goto("/");
  await page.getByRole("link", { name: "Álgebra" }).click();
  await page.getByRole("link", { name: "Estudar" }).click();
  await page.getByRole("button", { name: "Mostrar resposta" }).click();
  const card = page.getByTestId("study-card");
  await expect(card.locator(".katex .mfrac")).toBeVisible();
  await expect(card.locator(".katex .sqrt")).toBeVisible();
  await expect(card.locator(".katex-display .mtable")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(card).toHaveScreenshot("card-formulas.png", { maxDiffPixelRatio: 0.01 });
});
