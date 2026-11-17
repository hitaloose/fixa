import { gunzipSync, gzipSync, strFromU8, strToU8 } from "fflate";

/** Backup files are gzip-compressed JSON (docs/06-dados-e-backup.md). */
/** Copied into an ArrayBuffer-backed array so it can go straight into a Blob. */
export const gzipText = (text: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(gzipSync(strToU8(text)));

export const gunzipText = (bytes: Uint8Array): string => strFromU8(gunzipSync(bytes));
