import { expect, test } from "@playwright/test";

test("limits today's new cards for one deck from its options", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Novo baralho" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo baralho" });
  await dialog.getByRole("textbox", { name: "Nome" }).fill("Inglês");
  await dialog.getByRole("button", { name: "Criar" }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/add");
  for (const word of ["cat", "dog", "bird"]) {
    await page.getByRole("textbox", { name: "Frente" }).click();
    await page.keyboard.type(word);
    await page.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Nota adicionada.");
    await expect(page.getByRole("textbox", { name: "Frente" })).toHaveText("");
  }

  await page.goto("/");
  await page.getByRole("link", { name: "Inglês" }).click();
  const newCount = page.getByRole("listitem").filter({ hasText: "Novos" });
  await expect(newCount).toHaveText("3Novos");
  await page.getByRole("link", { name: "Opções do baralho" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Opções" })).toBeVisible();

  await page
    .getByRole("radiogroup", { name: "Aplicar limite de novos" })
    .getByText("Só hoje")
    .click();
  await page.getByRole("spinbutton", { name: "Novos por dia" }).fill("1");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("status")).toHaveText("Opções salvas.");

  await page.getByRole("link", { name: "Voltar para o baralho" }).click();
  await expect(newCount).toHaveText("1Novos");
});
