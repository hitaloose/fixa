export type DeckErrorCode = "exists" | "name-taken" | "cycle" | "invalid-name" | "not-found";

/** A rejected deck operation; the UI maps `code` to a message in src/i18n. */
export class DeckOperationError extends Error {
  constructor(readonly code: DeckErrorCode) {
    super(`deck operation failed: ${code}`);
    this.name = "DeckOperationError";
  }
}
