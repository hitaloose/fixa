import { expect, type Page, test } from "@playwright/test";

/** Review logs marked as undone, read straight from IndexedDB. */
function undoneLogs(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open("fixa");
      req.onsuccess = () => resolve(req.result);
    });
    const logs = await new Promise<Array<{ undoneAt: number | null }>>((resolve) => {
      const req = db.transaction("reviewLogs").objectStore("reviewLogs").getAll();
      req.onsuccess = () => resolve(req.result);
    });
    db.close();
    return logs.filter((l) => l.undoneAt !== null).length;
  });
}

async function setup(page: Page) {
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
}

test("studies a deck with buttons, keyboard and undo", async ({ page }) => {
  await setup(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Inglês" }).click();
  await page.getByRole("link", { name: "Estudar" }).click();

  const card = page.getByTestId("card-content");
  await expect(card).toHaveText("cat");
  await expect(page.getByText("2 novos, 0 aprendendo, 0 para revisar")).toBeAttached();
  await page.getByRole("button", { name: "Mostrar resposta" }).click();
  await expect(card).toContainText("gato");
  await page.getByRole("button", { name: /^Bom/ }).click();

  await expect(card).toHaveText("dog");
  await page.keyboard.press("Space");
  await expect(card).toContainText("cão");
  await page.keyboard.press("4");
  // Only the learning card is left, inside the 20-minute learn-ahead window.
  await expect(card).toHaveText("cat");

  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(card).toHaveText("dog");

  // Writes are persisted right after the screen moves on: wait for the undo to land.
  await expect.poll(() => undoneLogs(page)).toBe(1);
  await page.reload();
  await expect(card).toHaveText("dog");
  await expect(page.getByText("1 novo, 1 aprendendo, 0 para revisar")).toBeAttached();
});

test("custom study: reviews the cards forgotten today", async ({ page }) => {
  await setup(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Inglês" }).click();
  await page.getByRole("link", { name: "Estudar" }).click();
  await page.getByRole("button", { name: "Mostrar resposta" }).click();
  await page.getByRole("button", { name: /^De novo/ }).click();
  await expect
    .poll(() =>
      page.evaluate(() => document.querySelector("[data-testid=card-content]")?.textContent),
    )
    .toBe("dog");

  await page.getByRole("link", { name: "Voltar para o baralho" }).click();
  await page.getByRole("button", { name: "Estudo personalizado" }).click();
  await page
    .getByRole("dialog", { name: "Estudo personalizado" })
    .getByRole("link", { name: /Esquecidos hoje/ })
    .click();
  await expect(page.getByText("Esquecidos hoje")).toBeVisible();
  await expect(page.getByTestId("card-content")).toHaveText("cat");
});
