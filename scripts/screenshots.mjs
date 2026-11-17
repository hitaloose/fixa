// Captures the README screenshots from a running preview (pnpm build && pnpm preview).
// Usage: node scripts/screenshots.mjs [baseUrl]  →  docs/images/*.png (390×844 @2x)
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:4173/";
const OUT = "docs/images";
const browser = await chromium.launch();

async function device(colorScheme = "light") {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme,
    locale: "pt-BR",
  });
  return context.newPage();
}

async function seed(page) {
  await page.goto(`${BASE}import`);
  await page.getByLabel("Escolher arquivo").setInputFiles("tests/fixtures/anki/legacy.apkg");
  await page.getByRole("status").waitFor();
  // A fresh profile would show the "no backup yet" reminder: mark one as done.
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("fixa");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("settings", "readwrite");
          tx.objectStore("settings").put({ key: "lastBackupAt", value: Date.now() });
          tx.oncomplete = () => {
            open.result.close();
            resolve(undefined);
          };
        };
      }),
  );

  await page.goto(BASE);
  await page.getByRole("button", { name: "Novo baralho" }).click();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: "Nome" })
    .fill("Matemática::Geometria");
  await page.getByRole("dialog").getByRole("button", { name: "Criar" }).click();
  await page.getByRole("link", { name: "Matemática" }).waitFor();

  const cards = [
    ["Volume da esfera", "V = \\frac{4}{3}\\pi r^3"],
    ["Área do círculo", "A = \\pi r^2"],
    ["Fórmula de Bhaskara", "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"],
  ];
  await page.goto(`${BASE}add`);
  await page
    .getByRole("combobox", { name: "Baralho" })
    .selectOption({ label: "Matemática::Geometria" });
  for (const [front, latex] of cards) {
    await page.getByRole("textbox", { name: "Frente" }).click();
    await page.keyboard.type(front);
    await page.getByRole("button", { name: "Inserir fórmula" }).nth(1).click();
    const sheet = page.getByRole("dialog", { name: "Fórmula" });
    await sheet.getByRole("button", { name: "LaTeX" }).click();
    await sheet.getByRole("textbox", { name: "LaTeX" }).fill(latex);
    await sheet.getByRole("button", { name: "Em destaque" }).click();
    await sheet.getByRole("button", { name: "Inserir" }).click();
    await sheet.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Adicionar", exact: true }).click();
    await page.getByRole("status").waitFor();
    await page.getByRole("textbox", { name: "Frente" }).filter({ hasText: /^$/ }).waitFor();
  }
}

async function studyGeometry(page) {
  await page.goto(BASE);
  await page.getByRole("link", { name: "Geometria" }).click();
  await page.getByRole("link", { name: "Estudar" }).click();
  await page.getByRole("button", { name: "Mostrar resposta" }).click();
  await page.locator(".katex").first().waitFor();
  await page.waitForTimeout(300);
}

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

// Light
const light = await device("light");
await seed(light);
await light.goto(BASE);
await light.getByRole("link", { name: "Geometria" }).waitFor();
await shot(light, "inicio");

await studyGeometry(light);
await shot(light, "estudo");
for (const rating of ["Bom", "Fácil", "De novo"]) {
  await light.getByRole("button", { name: new RegExp(`^${rating}`) }).click();
  const reveal = light.getByRole("button", { name: "Mostrar resposta" });
  if (await reveal.isVisible().catch(() => false)) await reveal.click();
}

await light.goto(`${BASE}add`);
await light.getByRole("textbox", { name: "Frente" }).click();
await light.keyboard.type("Lei de Coulomb");
await light.getByRole("button", { name: "Inserir fórmula" }).nth(1).click();
const sheet = light.getByRole("dialog", { name: "Fórmula" });
await sheet.getByRole("button", { name: "LaTeX" }).click();
await sheet.getByRole("textbox", { name: "LaTeX" }).fill("F = k \\frac{|q_1 q_2|}{d^2}");
await sheet.getByRole("button", { name: "Em destaque" }).click();
await sheet.locator(".katex").waitFor();
await light.waitForTimeout(500);
await shot(light, "formula");

await light.goto(`${BASE}stats`);
await light.getByRole("radio", { name: "1 ano" }).check({ force: true });
await light.getByRole("region", { name: "Retenção real" }).waitFor();
await light.waitForTimeout(300);
await shot(light, "estatisticas");

// Dark
const dark = await device("dark");
await seed(dark);
await studyGeometry(dark);
await shot(dark, "escuro");

await browser.close();
console.log(`screenshots written to ${OUT}/`);
