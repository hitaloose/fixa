import type { EntityTable } from "dexie";
import { type Media, parseMedia } from "../../domain/model";
import { sha256Hex } from "../../lib/hash";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
};

function extensionOf(blob: Blob, originalName: string): string {
  const fromName = /\.([a-z0-9]{2,5})$/i.exec(originalName)?.[1];
  return (fromName ?? EXTENSION_BY_MIME[blob.type] ?? "bin").toLowerCase();
}

/** Media is content-addressed (id = SHA-256), so storing the same content twice is a no-op. */
export function createMediaRepository({ table }: { table: EntityTable<Media, "id"> }) {
  async function put(media: Media): Promise<Media> {
    const valid = parseMedia(media);
    const existing = await table.get(valid.id);
    if (existing) return existing;
    await table.add(valid);
    return valid;
  }

  return {
    put,

    /** Stores a picked/recorded file as `<sha256>.<ext>` — the name used in field HTML. */
    async storeFile(blob: Blob, originalName: string): Promise<Media> {
      const id = await sha256Hex(blob);
      return put({
        id,
        fileName: `${id}.${extensionOf(blob, originalName)}`,
        mime: blob.type || "application/octet-stream",
        size: blob.size,
        blob,
      });
    },

    get: (id: string) => table.get(id),

    byFileName: (fileName: string) => table.where("fileName").equals(fileName).first(),
  };
}
