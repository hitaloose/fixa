import { expect, type Page, test } from "@playwright/test";

async function createDeck(page: Page, path: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Novo baralho" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo baralho" });
  await dialog.getByRole("textbox", { name: "Nome" }).fill(path);
  await dialog.getByRole("button", { name: "Criar" }).click();
  await expect(dialog).toBeHidden();
}

test("adds a formatted note, then edits it from the history", async ({ page }) => {
  await createDeck(page, "Inglês");
  await page.getByRole("link", { name: "Adicionar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Adicionar" })).toBeVisible();

  const front = page.getByRole("textbox", { name: "Frente" });
  await front.click();
  await page.keyboard.type("the ");
  await page.getByRole("button", { name: "Negrito" }).first().click();
  await page.keyboard.type("cat");
  await expect(front.locator("strong")).toHaveText("cat");

  await page.getByRole("textbox", { name: "Verso" }).click();
  await page.keyboard.type("o gato");
  await page.getByRole("button", { name: "Pré-visualizar" }).click();
  const preview = page.getByRole("dialog", { name: "Pré-visualização" });
  await expect(preview.getByRole("article")).toHaveCount(1);
  await expect(preview.getByRole("article")).toContainText("o gato");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Nota adicionada.");
  await expect(front).toHaveText("");

  await page.getByRole("button", { name: "Histórico" }).click();
  await page
    .getByRole("dialog", { name: "Adicionadas recentemente" })
    .getByRole("link", { name: "the cat" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Editar nota" })).toBeVisible();
  const back = page.getByRole("textbox", { name: "Verso" });
  await expect(back).toHaveText("o gato");
  await back.click();
  await page.keyboard.press("End");
  await page.keyboard.type("!");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Adicionar" })).toBeVisible();

  await page.getByRole("button", { name: "Histórico" }).click();
  await page.getByRole("link", { name: "the cat" }).click();
  await expect(page.getByRole("textbox", { name: "Verso" })).toHaveText("o gato!");
});

test("creates cloze deletions from the selection", async ({ page }) => {
  await createDeck(page, "Geografia");
  await page.goto("/add");
  await page.getByRole("combobox", { name: "Tipo de nota" }).selectOption({ label: "Omissão" });
  const text = page.getByRole("textbox", { name: "Texto" });
  await text.click();
  await page.keyboard.type("Brasília");
  await page.keyboard.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Omissão" }).first().click();
  await expect(text).toHaveText("{{c1::Brasília}}");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Nota adicionada.");
});
