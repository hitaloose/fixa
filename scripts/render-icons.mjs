// Renders public/favicon.svg into the PNG icons the PWA manifest and iOS need.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync("public/favicon.svg", "utf8");
const browser = await chromium.launch();
for (const [file, size, pad] of [
  ["pwa-192.png", 192, 0],
  ["pwa-512.png", 512, 0],
  ["apple-touch-icon.png", 180, 0],
]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<body style="margin:0;padding:${pad}px">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`,
  );
  await page.screenshot({ path: `public/${file}`, omitBackground: true });
}
await browser.close();
