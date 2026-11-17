import { subtreeIds } from "../../domain/decks";
import { buildAnkiExport } from "../../domain/export/anki";
import type { Clock } from "../../domain/ports";
import type { ApkgRows } from "../../lib/anki/writeApkg";
import { ankiChecksum } from "../../lib/hash";
import type { FixaDb } from "../db";

export interface AnkiPackageData {
  rows: ApkgRows;
  media: Array<{ name: string; bytes: Uint8Array }>;
  fileName: string;
}

const active = <T extends { deletedAt: number | null }>(rows: T[]) =>
  rows.filter((r) => r.deletedAt === null);

/** Gathers what an .apkg export needs; the SQLite file is written elsewhere (worker). */
export function createAnkiExportRepository({ db, clock }: { db: FixaDb; clock: Clock }) {
  return {
    /** One deck with its subdecks, or everything when `deckId` is omitted. */
    async buildPackage(deckId?: string): Promise<AnkiPackageData> {
      const allDecks = active(await db.decks.toArray());
      const deckIds = new Set(deckId ? subtreeIds(deckId, allDecks) : allDecks.map((d) => d.id));
      const decks = allDecks.filter((d) => deckIds.has(d.id));
      const cards = active(
        await db.cards
          .where("deckId")
          .anyOf([...deckIds])
          .toArray(),
      );
      const noteIds = [...new Set(cards.map((c) => c.noteId))];
      const notes = active((await db.notes.bulkGet(noteIds)).filter((n) => n !== undefined));
      const noteTypeIds = new Set(notes.map((n) => n.noteTypeId));
      const noteTypes = (await db.noteTypes.toArray()).filter((nt) => noteTypeIds.has(nt.id));
      const presetIds = new Set(decks.map((d) => d.presetId));
      const presets = (await db.presets.toArray()).filter((p) => presetIds.has(p.id));
      const reviewLogs = await db.reviewLogs
        .where("cardId")
        .anyOf(cards.map((c) => c.id))
        .toArray();

      const built = buildAnkiExport({
        decks,
        presets,
        noteTypes,
        notes,
        cards,
        reviewLogs,
        now: clock.now(),
      });
      const rows: ApkgRows = {
        ...built,
        notes: await Promise.all(
          built.notes.map(async (n) => ({ ...n, csum: await ankiChecksum(n.sfld) })),
        ),
      };
      const media = (
        await Promise.all(
          built.media.map(async (name) => {
            const stored = await db.media.where("fileName").equals(name).first();
            return stored ? [{ name, bytes: new Uint8Array(await stored.blob.arrayBuffer()) }] : [];
          }),
        )
      ).flat();
      const root = deckId ? allDecks.find((d) => d.id === deckId) : undefined;
      return {
        rows,
        media,
        fileName: `${root ? root.name.replace(/[\\/:*?"<>|]/g, "-") : "fixa"}.apkg`,
      };
    },
  };
}
