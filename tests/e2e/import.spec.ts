import { expect, test } from "@playwright/test";

test("imports a real Anki package in the browser (worker + sql.js), then finds its cards", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.getByRole("link", { name: "Importar do Anki" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Importar do Anki" })).toBeVisible();
  await page
    .getByLabel("Escolher arquivo do Anki")
    .setInputFiles("tests/fixtures/anki/legacy.apkg");
  await expect(page.getByRole("status")).toHaveText("Importado: 2 baralhos, 4 notas, 5 cartões.");

  await page.getByRole("link", { name: "Ver baralhos" }).click();
  await expect(page.getByRole("list", { name: "Lista de baralhos" }).getByRole("link")).toHaveText([
    "Inglês",
    "Animais",
  ]);
  await page.goto("/browse?q=gato");
  const results = page.getByRole("list", { name: "Resultados" });
  await expect(results.getByRole("link")).toHaveText(["cat"]);
  await expect(results).toContainText("Inglês::Animais");
});

test("imports a package in Anki's current format (zstd + protobuf)", async ({ page }) => {
  await page.goto("/import");
  await page
    .getByLabel("Escolher arquivo do Anki")
    .setInputFiles("tests/fixtures/anki/anki21b.apkg");
  await expect(page.getByRole("status")).toHaveText("Importado: 2 baralhos, 4 notas, 5 cartões.");
  await page.goto("/browse?q=gato");
  await expect(page.getByRole("list", { name: "Resultados" }).getByRole("link")).toHaveText([
    "cat",
  ]);
});
