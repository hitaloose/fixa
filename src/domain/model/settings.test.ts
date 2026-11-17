import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, settingsSchema } from "./settings";

describe("settingsSchema", () => {
  it("documents device defaults: 04:00 cutoff, no backup yet, haptics on, theme follows the device", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      cutoffHour: 4,
      lastBackupAt: null,
      backupReminderDays: 7,
      haptics: true,
      theme: "system",
    });
  });

  it.each([
    [0, true],
    [23, true],
    [24, false],
    [-1, false],
    [4.5, false],
  ])("cutoffHour %f is valid: %s", (cutoffHour, ok) => {
    expect(settingsSchema.shape.cutoffHour.safeParse(cutoffHour).success).toBe(ok);
  });
});
