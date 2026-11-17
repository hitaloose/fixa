import { expect, type Page, test } from "@playwright/test";

/** Everything that takes typing or a choice from a list (iOS zooms into these on focus). */
const CONTROLS =
  'input:not([type="checkbox"], [type="radio"], [type="range"], [type="file"]), select, textarea, [contenteditable="true"]';

/** Font sizes of the form controls on the page, keyed by a short description of each. */
const controlFontSizes = (page: Page) =>
  page.locator(CONTROLS).evaluateAll((els) =>
    els.map((el) => ({
      control: `${el.tagName.toLowerCase()} ${el.getAttribute("aria-label") ?? el.id}`,
      px: Number.parseFloat(getComputedStyle(el).fontSize),
    })),
  );

// iOS Safari zooms the page into any focused field whose text is smaller than 16px, leaving
// it zoomed (with scrollbars) after the keyboard closes.
test("form controls are at least 16px so iOS does not zoom in on them", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Novo baralho" }).click();
  const newDeck = page.getByRole("dialog", { name: "Novo baralho" });
  await newDeck.getByRole("textbox", { name: "Nome" }).fill("Geral");
  await newDeck.getByRole("button", { name: "Criar" }).click();
  await expect(newDeck).toBeHidden();

  const found: Array<{ control: string; px: number }> = [];
  for (const path of ["/add", "/browse", "/stats", "/settings", "/import", "/note-types"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    found.push(...(await controlFontSizes(page)));
  }
  await page.goto("/add");
  await page.getByRole("button", { name: "Inserir fórmula" }).first().click();
  await page
    .getByRole("dialog", { name: "Fórmula" })
    .getByRole("button", { name: "LaTeX" })
    .click();
  found.push(...(await controlFontSizes(page)));

  expect(found.length).toBeGreaterThan(5);
  expect(found.filter((c) => c.px < 16)).toEqual([]);
});

// iOS draws native <select>s at its own (shorter) height, ignoring min-height and padding.
test("selects are as tall as text fields", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Novo baralho" }).click();
  const newDeck = page.getByRole("dialog", { name: "Novo baralho" });
  await newDeck.getByRole("textbox", { name: "Nome" }).fill("Geral");
  await newDeck.getByRole("button", { name: "Criar" }).click();
  await expect(newDeck).toBeHidden();

  await page.goto("/add");
  const select = page.getByRole("combobox", { name: "Tipo de nota" });
  const textField = page.getByRole("textbox", { name: "Etiquetas" });
  await expect(select).toBeVisible();
  expect(await select.evaluate((el) => getComputedStyle(el).appearance)).toBe("none");
  const [selectBox, fieldBox] = [await select.boundingBox(), await textField.boundingBox()];
  expect(selectBox?.height).toBe(fieldBox?.height);
});
