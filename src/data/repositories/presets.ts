import {
  defaultPresetValues,
  type Preset,
  type PresetInput,
  type PresetValues,
  parsePreset,
} from "../../domain/model";
import type { Clock, IdGenerator } from "../../domain/ports";
import type { FixaDb } from "../db";
import { createEntityRepository } from "./entityRepository";

export function createPresetsRepository({
  db,
  clock,
  ids,
}: {
  db: FixaDb;
  clock: Clock;
  ids: IdGenerator;
}) {
  const base = createEntityRepository<Preset, PresetInput>({
    table: db.presets,
    parse: parsePreset,
    clock,
    ids,
  });

  return {
    ...base,

    clone: (name: string, values: PresetValues) => base.create({ ...values, name }),

    /** Deletes a preset; decks that used it switch to `fallbackId` (the default preset). */
    async remove(id: string, fallbackId: string): Promise<void> {
      if (id === fallbackId) throw new Error("the default preset cannot be deleted");
      const now = clock.now();
      await db.transaction("rw", db.presets, db.decks, async () => {
        await db.decks
          .where("presetId")
          .equals(id)
          .modify((d) => {
            d.presetId = fallbackId;
            d.updatedAt = now;
          });
        await base.softDelete(id);
      });
    },

    restoreDefaults: (id: string) => base.update(id, defaultPresetValues()),

    /** Active decks per preset id. */
    async usage(): Promise<Record<string, number>> {
      const decks = await db.decks.filter((d) => d.deletedAt === null).toArray();
      const counts: Record<string, number> = {};
      for (const d of decks) counts[d.presetId] = (counts[d.presetId] ?? 0) + 1;
      return counts;
    },
  };
}
