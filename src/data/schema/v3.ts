import { v2 } from "./v2";

/**
 * Schema v3: a "handles" table keeps the folder chosen for automatic backups (a
 * FileSystemDirectoryHandle, structured-clonable). Only a table is added: no upgrade() needed.
 * NEVER edit after it is published — add v4.ts instead.
 */
export const v3 = {
  ...v2,
  handles: "key",
} as const;
