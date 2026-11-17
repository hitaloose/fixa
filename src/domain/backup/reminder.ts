/** Backup reminder on the home screen (docs/06-dados-e-backup.md › Lembrete de backup). */
const DAY_MS = 86_400_000;

export interface BackupReminderInput {
  now: number;
  /** settings.lastBackupAt */
  lastBackupAt: number | null;
  firstReviewAt: number | null;
  lastReviewAt: number | null;
  /** settings.backupReminderDays */
  reminderDays: number;
}

/** null = no reminder; daysSince null = never backed up. */
export function backupReminder({
  now,
  lastBackupAt,
  firstReviewAt,
  lastReviewAt,
  reminderDays,
}: BackupReminderInput): { daysSince: number | null } | null {
  if (firstReviewAt === null || lastReviewAt === null) return null;
  const limit = reminderDays * DAY_MS;
  if (lastBackupAt === null) return now - firstReviewAt >= limit ? { daysSince: null } : null;
  if (lastReviewAt <= lastBackupAt || now - lastBackupAt < limit) return null;
  return { daysSince: Math.floor((now - lastBackupAt) / DAY_MS) };
}
