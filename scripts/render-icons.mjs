// Derives every icon from public/favicon.svg (the single source of the logo, docs/09 › Marca):
// - PNGs for the PWA manifest and iOS;
// - a full-bleed maskable PNG for Android (logo shrunk into the 80% safe zone);
// - public/logo-mono.svg, the one-colour mark (fill = currentColor) without the tile.
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync("public/favicon.svg", "utf8");
const TILE = '<rect width="512" height="512" rx="112" fill="#17181C"/>';
if (!svg.includes(TILE)) throw new Error("favicon.svg: tile rect not found");
const inner = svg
  .replace(/^[\s\S]*?<\/title>/, "")
  .replace(TILE, "")
  .replace("</svg>", "")
  .trim();

const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#17181C"/><g transform="translate(256 256) scale(0.8) translate(-256 -256)">${inner}</g></svg>`;

const mono = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="96 96 320 320"><title>Fixa</title>${inner.replace(/fill="#[0-9A-Fa-f]{6}"/g, 'fill="currentColor"')}</svg>\n`;
writeFileSync("public/logo-mono.svg", mono);

const browser = await chromium.launch();
for (const [file, size, source] of [
  ["pwa-192.png", 192, svg],
  ["pwa-512.png", 512, svg],
  ["apple-touch-icon.png", 180, svg],
  ["pwa-maskable-512.png", 512, maskable],
]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<body style="margin:0">${source.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`,
  );
  await page.screenshot({ path: `public/${file}`, omitBackground: true });
}
await browser.close();
