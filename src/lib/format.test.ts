import { describe, expect, it } from "vitest";
import { formatInterval, type IntervalLabels } from "./format";

const labels: IntervalLabels = {
  lessThanMinute: "<1m",
  minutes: (n) => `${n}m`,
  hours: (n) => `${n}h`,
  days: (n) => `${n}d`,
  months: (n) => `${n}mo`,
  years: (n) => `${n}y`,
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatInterval", () => {
  it.each([
    [-1, "<1m"],
    [0, "<1m"],
    [59_999, "<1m"],
    [MIN, "1m"],
    [6 * MIN, "6m"],
    [59.4 * MIN, "59m"],
    [59.6 * MIN, "1h"],
    [89.9 * MIN, "1h"],
    [5 * HOUR, "5h"],
    [23.6 * HOUR, "1d"],
    [DAY, "1d"],
    [4 * DAY, "4d"],
    [29.4 * DAY, "29d"],
    [29.6 * DAY, "1mo"],
    [45 * DAY, "1.5mo"],
    [200 * DAY, "6.7mo"],
    [364 * DAY, "1y"],
    [840 * DAY, "2.3y"],
  ])("%f ms → %s", (ms, expected) => {
    expect(formatInterval(ms, labels)).toBe(expected);
  });
});
