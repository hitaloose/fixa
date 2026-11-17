export type DeckErrorCode = "exists" | "name-taken" | "cycle" | "invalid-name" | "not-found";

/** A rejected deck operation; the UI maps `code` to a message in src/i18n. */
export class DeckOperationError extends Error {
  constructor(readonly code: DeckErrorCode) {
    super(`deck operation failed: ${code}`);
    this.name = "DeckOperationError";
  }
}

export type NoteErrorCode = "no-cards" | "not-found";

/** A rejected note operation; the UI maps `code` to a message in src/i18n. */
export class NoteOperationError extends Error {
  constructor(readonly code: NoteErrorCode) {
    super(`note operation failed: ${code}`);
    this.name = "NoteOperationError";
  }
}

export type BackupFileErrorCode = "unreadable" | "invalid";

/** A file that cannot be restored; the UI maps `code` to a message in src/i18n. */
export class BackupFileError extends Error {
  constructor(readonly code: BackupFileErrorCode) {
    super(`backup file rejected: ${code}`);
    this.name = "BackupFileError";
  }
}
