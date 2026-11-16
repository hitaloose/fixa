import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { bootstrap } from "./app/bootstrap";
import { router } from "./app/router";
import "./app/fonts";
import "./app/styles/theme.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

await bootstrap();

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
