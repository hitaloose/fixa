import type { EntityTable } from "dexie";
import { type Media, parseMedia } from "../../domain/model";

/** Media is content-addressed (id = SHA-256), so storing the same content twice is a no-op. */
export function createMediaRepository({ table }: { table: EntityTable<Media, "id"> }) {
  return {
    async put(media: Media): Promise<Media> {
      const valid = parseMedia(media);
      const existing = await table.get(valid.id);
      if (existing) return existing;
      await table.add(valid);
      return valid;
    },

    get: (id: string) => table.get(id),
  };
}
