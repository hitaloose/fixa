import { expect, test } from "@playwright/test";

test("searches cards, keeps the search in the URL and suspends a selection", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Novo baralho" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo baralho" });
  await dialog.getByRole("textbox", { name: "Nome" }).fill("Inglês");
  await dialog.getByRole("button", { name: "Criar" }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/add");
  for (const [front, back] of [
    ["cat", "gato"],
    ["dog", "cão"],
  ]) {
    await page.getByRole("textbox", { name: "Frente" }).click();
    await page.keyboard.type(front as string);
    await page.getByRole("textbox", { name: "Verso" }).click();
    await page.keyboard.type(back as string);
    await page.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Nota adicionada.");
    await expect(page.getByRole("textbox", { name: "Frente" })).toHaveText("");
  }

  await page.getByRole("link", { name: "Navegar" }).click();
  const results = page.getByRole("list", { name: "Resultados" });
  await expect(results.getByRole("link")).toHaveText(["dog", "cat"]);

  await page.getByRole("searchbox", { name: "Buscar cartões" }).fill("gato");
  await expect(results.getByRole("link")).toHaveText(["cat"]);
  await expect(page).toHaveURL(/q=gato/);
  await page.reload();
  await expect(page.getByRole("searchbox", { name: "Buscar cartões" })).toHaveValue("gato");

  await page.getByRole("checkbox", { name: "Selecionar cat" }).check();
  await page
    .getByRole("region", { name: "Seleção" })
    .getByRole("button", { name: "Ações" })
    .click();
  await page
    .getByRole("dialog", { name: "Ações" })
    .getByRole("button", { name: "Suspender" })
    .click();
  await expect(results).toContainText("Suspenso");

  await page.getByRole("searchbox", { name: "Buscar cartões" }).fill("");
  await page.getByRole("button", { name: "Suspensos" }).click();
  await expect(results.getByRole("link")).toHaveText(["cat"]);
});
