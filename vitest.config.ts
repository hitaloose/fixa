import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            "src/**/*.test.ts",
            "tests/factories/**/*.test.ts",
            "tests/architecture/**/*.test.ts",
          ],
          setupFiles: ["./tests/setup.node.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./tests/setup.node.ts", "./tests/setup.dom.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/data/**", "src/ui/**", "src/features/**", "src/lib/**"],
      exclude: ["**/*.test.{ts,tsx}", "**/index.ts", "src/routeTree.gen.ts"],
      thresholds: {
        "src/domain/**": { lines: 95, branches: 90 },
        "src/data/**": { lines: 90, branches: 85 },
        "src/ui/**": { lines: 80, branches: 75 },
        "src/features/**": { lines: 80, branches: 75 },
      },
    },
  },
});
