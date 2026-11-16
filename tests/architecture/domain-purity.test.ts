import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const DOMAIN = join(import.meta.dirname, "../../src/domain");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

const FORBIDDEN: Array<[RegExp, string]> = [
  [/\bDate\.now\s*\(/, "Date.now() — inject a Clock"],
  [/\bnew Date\s*\(\s*\)/, "new Date() without args — inject a Clock"],
  [/\bMath\.random\s*\(/, "Math.random() — inject an IdGenerator / RNG"],
];

describe("src/domain purity", () => {
  it("never reads the real clock or randomness", () => {
    const violations = sourceFiles(DOMAIN).flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return FORBIDDEN.filter(([re]) => re.test(text)).map(
        ([, why]) => `${relative(DOMAIN, file)}: ${why}`,
      );
    });
    expect(violations).toEqual([]);
  });
});
