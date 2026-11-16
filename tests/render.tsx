import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

/** Renders `ui` inside a minimal router so feature components can use <Link>. */
export function renderWithRouter(ui: ReactNode, { path = "/" } = {}) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const screen = () => <>{ui}</>;
  const index = createRoute({ getParentRoute: () => rootRoute, path: "/", component: screen });
  const anyPath = createRoute({ getParentRoute: () => rootRoute, path: "$", component: screen });
  const router = createRouter({
    routeTree: rootRoute.addChildren([index, anyPath]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return { router, ...render(<RouterProvider router={router} />) };
}
