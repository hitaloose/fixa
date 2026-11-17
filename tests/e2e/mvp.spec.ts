import { expect, test } from "@playwright/test";

test("works end to end offline: deck → card with a fraction → study → statistics", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // the active service worker now controls the page
  await context.setOffline(true);
  await page.reload();

  await page.getByRole("button", { name: "Novo baralho" }).click();
  const newDeck = page.getByRole("dialog", { name: "Novo baralho" });
  await newDeck.getByRole("textbox", { name: "Nome" }).fill("Matemática");
  await newDeck.getByRole("button", { name: "Criar" }).click();
  await expect(newDeck).toBeHidden();

  await page.getByRole("link", { name: "Adicionar", exact: true }).click();
  await page.getByRole("textbox", { name: "Frente" }).click();
  await page.keyboard.type("Quanto é três quartos?");
  await page.getByRole("button", { name: "Inserir fórmula" }).nth(1).click();
  const sheet = page.getByRole("dialog", { name: "Fórmula" });
  await sheet.getByRole("button", { name: "LaTeX" }).click();
  await sheet.getByRole("textbox", { name: "LaTeX" }).fill("\\frac{3}{4}");
  await sheet.getByRole("button", { name: "Inserir" }).click();
  await expect(page.getByRole("textbox", { name: "Verso" }).locator(".katex .mfrac")).toBeVisible();
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Nota adicionada.");

  await page.getByRole("link", { name: "Baralhos" }).click();
  await page.getByRole("link", { name: "Matemática" }).click();
  await page.getByRole("link", { name: "Estudar" }).click();
  const card = page.getByTestId("card-content");
  await expect(card).toHaveText("Quanto é três quartos?");
  await page.getByRole("button", { name: "Mostrar resposta" }).click();
  await expect(card.locator(".katex .mfrac")).toBeVisible();
  await page.getByRole("button", { name: /^Fácil/ }).click();
  await expect(
    page.getByText("Tudo em dia! Nada mais para estudar neste baralho hoje."),
  ).toBeVisible();

  await page.getByRole("link", { name: "Estatísticas" }).click();
  const today = page.getByRole("region", { name: "Hoje" });
  await expect(today.getByText("Respostas").locator("xpath=following-sibling::dd")).toHaveText("1");
  await expect(page.getByRole("region", { name: "Sequência" })).toContainText("1 dia");
});
