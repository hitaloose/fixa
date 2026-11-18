import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { bootstrap } from "./app/bootstrap";
import "./app/fonts";
import "./app/styles/theme.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

await bootstrap();
// Loaded after bootstrap so every module reads `t` in the chosen language.
const { router } = await import("./app/router");

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
