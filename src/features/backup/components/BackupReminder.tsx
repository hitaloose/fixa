import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { t } from "../../../i18n/pt-BR";
import { useBackupReminder } from "../hooks/useBackup";

const r = t.settings.reminder;

/** Discreet nudge on the home screen when a backup is overdue (docs/06 › Lembrete). */
export function BackupReminder() {
  const reminder = useBackupReminder();
  const id = useId();
  if (!reminder) return null;
  return (
    <section
      aria-labelledby={id}
      className="mt-4 flex items-center gap-3 rounded-list border border-learning-bg bg-learning-bg px-4 py-3 text-learning-ink"
    >
      <h2 id={id} className="sr-only">
        {r.title}
      </h2>
      <p className="flex-1 text-sm">
        {reminder.daysSince === null ? r.never : r.daysAgo(reminder.daysSince)}
      </p>
      <Link to="/settings" className="inline-flex min-h-11 items-center text-sm font-semibold">
        {r.action}
      </Link>
    </section>
  );
}
