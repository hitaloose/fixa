import { describe, expect, it } from "vitest";
import { backupReminder } from "./index";

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;
const base = { now: NOW, reminderDays: 7 };

describe("backupReminder", () => {
  it("stays quiet before any study", () => {
    expect(
      backupReminder({ ...base, lastBackupAt: null, firstReviewAt: null, lastReviewAt: null }),
    ).toBeNull();
  });

  it("asks for a first backup after a week of studying", () => {
    const first = { ...base, lastBackupAt: null, lastReviewAt: NOW - DAY };
    expect(backupReminder({ ...first, firstReviewAt: NOW - 6 * DAY })).toBeNull();
    expect(backupReminder({ ...first, firstReviewAt: NOW - 7 * DAY })).toEqual({ daysSince: null });
  });

  it("reminds when the last backup is old and there were reviews since", () => {
    const old = { ...base, lastBackupAt: NOW - 9 * DAY - 5, firstReviewAt: NOW - 30 * DAY };
    expect(backupReminder({ ...old, lastReviewAt: NOW - DAY })).toEqual({ daysSince: 9 });
    expect(backupReminder({ ...old, lastReviewAt: NOW - 10 * DAY })).toBeNull();
  });

  it("does not remind before the configured number of days", () => {
    expect(
      backupReminder({
        ...base,
        reminderDays: 14,
        lastBackupAt: NOW - 9 * DAY,
        firstReviewAt: NOW - 30 * DAY,
        lastReviewAt: NOW,
      }),
    ).toBeNull();
  });
});
