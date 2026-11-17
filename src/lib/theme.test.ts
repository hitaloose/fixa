// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { applyTheme, resolveTheme } from "./theme";

const prefersDark = (dark: boolean) => ({ matches: dark }) as MediaQueryList;

describe("resolveTheme", () => {
  it("follows the device for 'system' and the choice otherwise", () => {
    expect(resolveTheme("system", prefersDark(true))).toBe("dark");
    expect(resolveTheme("system", prefersDark(false))).toBe("light");
    expect(resolveTheme("dark", prefersDark(false))).toBe("dark");
    expect(resolveTheme("light", prefersDark(true))).toBe("light");
  });
});

describe("applyTheme", () => {
  it("sets data-theme and the browser theme colour", () => {
    const root = document.createElement("html");
    const meta = document.createElement("meta");
    applyTheme("dark", root, meta);
    expect(root.dataset.theme).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
    expect(meta.content).toBe("#111215");
    applyTheme("light", root, meta);
    expect(root.dataset.theme).toBe("light");
    expect(meta.content).toBe("#f5f3ee");
  });
});
