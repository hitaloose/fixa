import { expect, type Locator, test } from "@playwright/test";

/** True when the element's centre is not hidden behind something else (e.g. a keyboard). */
const uncovered = (locator: Locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  });

test("writes a stacked fraction with MathLive and studies it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Novo baralho" }).click();
  const newDeck = page.getByRole("dialog", { name: "Novo baralho" });
  await newDeck.getByRole("textbox", { name: "Nome" }).fill("Matemática");
  await newDeck.getByRole("button", { name: "Criar" }).click();
  await expect(newDeck).toBeHidden();

  await page.goto("/add");
  const front = page.getByRole("textbox", { name: "Frente" });
  await front.click();
  await page.keyboard.type("Quanto é ");
  await page.getByRole("button", { name: "Inserir fórmula" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Fórmula" });
  const field = sheet.locator("math-field");
  await expect(field).toBeVisible();
  await expect(field).toBeFocused();
  await field.click(); // a tap brings up MathLive's virtual keyboard
  await expect(page.locator(".ML__keyboard")).toBeVisible();
  await page.keyboard.type("3/4");
  await expect(sheet.getByRole("button", { name: "Inserir" })).toBeEnabled();
  // MathLive's virtual keyboard is up on touch devices; the sheet must stay usable above it.
  await expect.poll(() => uncovered(field)).toBe(true);
  await expect.poll(() => uncovered(sheet.getByRole("button", { name: "Inserir" }))).toBe(true);
  await sheet.getByRole("button", { name: "Inserir" }).click();
  await expect(sheet).toBeHidden();
  await expect(front.locator(".katex .mfrac")).toBeVisible();

  await page.getByRole("textbox", { name: "Verso" }).click();
  await page.keyboard.type("três quartos");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Nota adicionada.");

  await page.goto("/");
  await page.getByRole("link", { name: "Matemática" }).click();
  await page.getByRole("link", { name: "Estudar" }).click();
  const card = page.getByTestId("card-content");
  await expect(card.locator(".katex .mfrac")).toBeVisible();
  await expect(card).toContainText("Quanto é");
});

test("edits a formula as LaTeX and shows it as a block", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Novo baralho" }).click();
  const newDeck = page.getByRole("dialog", { name: "Novo baralho" });
  await newDeck.getByRole("textbox", { name: "Nome" }).fill("Física");
  await newDeck.getByRole("button", { name: "Criar" }).click();
  await expect(newDeck).toBeHidden();

  await page.goto("/add");
  await page.getByRole("button", { name: "Inserir fórmula" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Fórmula" });
  await sheet.getByRole("button", { name: "LaTeX" }).click();
  await sheet
    .getByRole("textbox", { name: "LaTeX" })
    .fill("x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}");
  await expect(
    sheet.getByRole("region", { name: "Pré-visualização da fórmula" }).locator(".sqrt"),
  ).toBeVisible();
  await sheet.getByRole("button", { name: "Em destaque" }).click();
  await sheet.getByRole("button", { name: "Inserir" }).click();
  const front = page.getByRole("textbox", { name: "Frente" });
  await expect(front.locator(".katex-display")).toBeVisible();

  await front.getByRole("button", { name: /^Editar fórmula/ }).click();
  await sheet.getByRole("button", { name: "LaTeX" }).click();
  await sheet.getByRole("textbox", { name: "LaTeX" }).fill("E = mc^2");
  await sheet.getByRole("button", { name: "Salvar" }).click();
  await expect(front.getByRole("button", { name: "Editar fórmula: E = mc^2" })).toBeVisible();
});

/** Opens the formula sheet on /add with MathLive's virtual keyboard up. */
async function openVirtualKeyboard(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Novo baralho" }).click();
  const newDeck = page.getByRole("dialog", { name: "Novo baralho" });
  await newDeck.getByRole("textbox", { name: "Nome" }).fill("Matemática");
  await newDeck.getByRole("button", { name: "Criar" }).click();
  await expect(newDeck).toBeHidden();
  await page.goto("/add");
  await page.getByRole("button", { name: "Inserir fórmula" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Fórmula" });
  const field = sheet.locator("math-field");
  await expect(field).toBeVisible();
  await field.click(); // a tap brings up MathLive's virtual keyboard
  const keyboard = page.locator(".ML__keyboard");
  await expect(keyboard).toBeVisible();
  return { sheet, field, keyboard };
}

test("types with the keys of MathLive's virtual keyboard", async ({ page }) => {
  const { sheet, field, keyboard } = await openVirtualKeyboard(page);
  await keyboard.getByLabel("7", { exact: true }).filter({ visible: true }).tap();
  await expect
    .poll(() => field.evaluate((el) => (el as HTMLElement & { value: string }).value))
    .toBe("7");
  await expect(sheet).toBeVisible();
  await expect(keyboard).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Inserir" })).toBeEnabled();
});

test("paints the formula field and keyboard with the app's theme, not the device's", async ({
  browser,
}) => {
  const page = await (await browser.newContext({ colorScheme: "light" })).newPage();
  await page.goto("/settings");
  await page.getByRole("radiogroup", { name: "Tema" }).getByText("Escuro").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const { field, keyboard } = await openVirtualKeyboard(page);
  await expect(keyboard.locator(".MLK__backdrop")).toHaveCSS("background-color", "rgb(17, 18, 21)");
  // MathLive paints the field with the system "field" colour, which stays white on iOS.
  await expect(field).toHaveCSS("background-color", "rgb(27, 28, 33)");
  await expect(field).toHaveCSS("color", "rgb(236, 235, 230)");
  // …and the highlight around the structure holding the caret, which is light by default.
  await page.keyboard.type("3/4");
  await expect(field.locator(".ML__contains-highlight").first()).toHaveCSS(
    "background-color",
    "rgb(37, 39, 45)",
  );
});
