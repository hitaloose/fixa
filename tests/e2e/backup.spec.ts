import { expect, type Page, test } from "@playwright/test";

/** Two isolated profiles, as two devices. The share sheet is disabled so export downloads. */
async function newDevice(browser: import("@playwright/test").Browser): Promise<Page> {
  const context = await browser.newContext({ acceptDownloads: true });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });
  return context.newPage();
}

async function createDeck(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Novo baralho" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo baralho" });
  await dialog.getByRole("textbox", { name: "Nome" }).fill(name);
  await dialog.getByRole("button", { name: "Criar" }).click();
  await expect(dialog).toBeHidden();
}

async function addCard(page: Page, front: string) {
  await page.goto("/add");
  await page.getByRole("textbox", { name: "Frente" }).click();
  await page.keyboard.type(front);
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Nota adicionada.");
}

test("exports on one device and merges into another, keeping both sides' work", async ({
  browser,
}, testInfo) => {
  const a = await newDevice(browser);
  const b = await newDevice(browser);

  await createDeck(a, "Inglês");
  await addCard(a, "cat");
  await createDeck(b, "Matemática");
  await addCard(b, "pi");

  await a.goto("/settings");
  const downloading = a.waitForEvent("download");
  await a.getByRole("button", { name: "Exportar backup" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^fixa-backup-\d{4}-\d{2}-\d{2}\.fixa$/);
  const file = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  await expect(a.getByText("Último backup: hoje")).toBeVisible();

  await b.goto("/settings");
  await b.getByLabel("Restaurar backup").setInputFiles(file);
  const restore = b.getByRole("dialog", { name: "Restaurar backup" });
  await expect(restore).toContainText("1 baralho, 1 cartão");
  await restore.getByRole("button", { name: "Mesclar" }).click();
  await expect(b.getByRole("status")).toHaveText("Backup mesclado.");

  await b.goto("/");
  await expect(b.getByRole("list", { name: "Lista de baralhos" }).getByRole("link")).toHaveText([
    "Inglês",
    "Matemática",
  ]);
  await b.goto("/browse");
  await expect(b.getByRole("list", { name: "Resultados" }).getByRole("link")).toHaveText([
    "pi",
    "cat",
  ]);
});
