import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeReviewLog } from "../../../../tests/factories";
import { renderWithRouter } from "../../../../tests/render";
import { setupRuntime } from "../../../../tests/runtime";
import { BackupReminder } from "./BackupReminder";

const NOW = Date.parse("2026-11-16T15:00:00Z");
const DAY = 86_400_000;

describe("BackupReminder", () => {
  it("asks for a first backup after a week of study", async () => {
    const rt = setupRuntime({ now: NOW });
    await rt.db.reviewLogs.bulkAdd([
      makeReviewLog({ reviewedAt: NOW - 8 * DAY }),
      makeReviewLog({ reviewedAt: NOW - DAY }),
    ]);
    renderWithRouter(<BackupReminder />);
    const reminder = await screen.findByRole("region", { name: "Backup" });
    expect(reminder).toHaveTextContent("Você ainda não fez um backup.");
    expect(screen.getByRole("link", { name: "Fazer backup" })).toHaveAttribute("href", "/settings");
  });

  it("says how old the last backup is", async () => {
    const rt = setupRuntime({ now: NOW });
    await rt.repos.settings.set("lastBackupAt", NOW - 9 * DAY);
    await rt.db.reviewLogs.add(makeReviewLog({ reviewedAt: NOW - DAY }));
    renderWithRouter(<BackupReminder />);
    expect(await screen.findByText("Seu último backup foi há 9 dias.")).toBeInTheDocument();
  });

  it("stays hidden when the backup is recent", async () => {
    const rt = setupRuntime({ now: NOW });
    await rt.repos.settings.set("lastBackupAt", NOW - 2 * DAY);
    await rt.db.reviewLogs.add(makeReviewLog({ reviewedAt: NOW - DAY }));
    renderWithRouter(<BackupReminder />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("region", { name: "Backup" })).not.toBeInTheDocument();
  });
});
