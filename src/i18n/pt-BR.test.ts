import { describe, expect, it } from "vitest";
import { t } from "./pt-BR";

describe("pt-BR interval labels", () => {
  it.each([
    ["minutes", 6, "6 min"],
    ["hours", 1, "1 h"],
    ["days", 1, "1 dia"],
    ["days", 4, "4 dias"],
    ["months", 1, "1 mês"],
    ["months", 1.5, "1,5 mês"],
    ["months", 2, "2 meses"],
    ["years", 1, "1 ano"],
    ["years", 2.3, "2,3 anos"],
  ] as const)("%s(%f) = %s", (unit, n, expected) => {
    expect(t.interval[unit](n)).toBe(expected);
  });

  it("has a label for under a minute", () => {
    expect(t.interval.lessThanMinute).toBe("< 1 min");
  });
});
