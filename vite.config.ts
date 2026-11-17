import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json" with { type: "json" };

/**
 * Public path. GitHub Pages serves a project site under /<repo>/: the deploy workflow passes it
 * as BASE_PATH (from actions/configure-pages). Locally, tests and previews use "/".
 */
const base = `${(process.env.BASE_PATH ?? "").replace(/\/+$/, "")}/`;

export default defineConfig({
  base,
  build: { target: "es2022" },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true, routesDirectory: "src/routes" }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Fixa",
        short_name: "Fixa",
        description: "Flashcards com repetição espaçada",
        lang: "pt-BR",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#F5F3EE",
        theme_color: "#F5F3EE",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,wasm}"],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
});
