import { expect, type Page, test } from "@playwright/test";

const deckList = (page: Page) => page.getByRole("list", { name: "Lista de baralhos" });

async function createDeck(page: Page, path: string) {
  await page.getByRole("button", { name: "Novo baralho" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo baralho" });
  await dialog.getByRole("textbox", { name: "Nome" }).fill(path);
  await dialog.getByRole("button", { name: "Criar" }).click();
  await expect(dialog).toBeHidden();
}

test("creates, organises and deletes decks, keeping them after reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Nenhum baralho ainda.")).toBeVisible();

  await createDeck(page, "Inglês::Phrasal verbs");
  await createDeck(page, "Matemática");
  await expect(deckList(page).getByRole("link")).toHaveText([
    "Inglês",
    "Phrasal verbs",
    "Matemática",
  ]);

  await page.reload();
  await expect(deckList(page).getByRole("link")).toHaveText([
    "Inglês",
    "Phrasal verbs",
    "Matemática",
  ]);

  await page.getByRole("button", { name: "Recolher Inglês" }).click();
  await expect(deckList(page).getByRole("link")).toHaveText(["Inglês", "Matemática"]);
  await page.getByRole("button", { name: "Expandir Inglês" }).click();

  await page.getByRole("link", { name: "Phrasal verbs" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Phrasal verbs" })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Próximos 7 dias" }).getByRole("listitem"),
  ).toHaveCount(7);
  await expect(
    page
      .getByRole("navigation", { name: "Navegação principal" })
      .getByRole("link", { name: "Baralhos" }),
  ).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Voltar para baralhos" }).click();

  await page.getByRole("button", { name: "Ações de Matemática" }).click();
  await page.getByRole("button", { name: "Renomear" }).click();
  const name = page.getByRole("dialog").getByRole("textbox", { name: "Nome" });
  await name.fill("Cálculo");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(deckList(page).getByRole("link", { name: "Cálculo" })).toBeVisible();

  await page.getByRole("button", { name: "Ações de Inglês" }).click();
  await page.getByRole("button", { name: "Excluir" }).click();
  await page
    .getByRole("dialog", { name: "Excluir “Inglês”?" })
    .getByRole("button", { name: "Excluir" })
    .click();
  await expect(deckList(page).getByRole("link")).toHaveText(["Cálculo"]);
});
