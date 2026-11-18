import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  makeCard,
  makeDeck,
  makeNote,
  makeNoteType,
  makePreset,
  makeReviewLog,
} from "../../../tests/factories";
import { type BackupData, buildBackup, parseBackup } from "./index";

function sampleData(): BackupData {
  const preset = makePreset();
  const deck = makeDeck({ presetId: preset.id });
  const noteType = makeNoteType();
  const note = makeNote({ noteTypeId: noteType.id });
  const card = makeCard({ noteId: note.id, deckId: deck.id });
  return {
    presets: [preset],
    decks: [deck],
    noteTypes: [noteType],
    notes: [note],
    cards: [card],
    reviewLogs: [makeReviewLog({ cardId: card.id })],
    settings: { cutoffHour: 5, haptics: false, language: "en" },
  };
}
const MEDIA = [
  { id: "ab".repeat(32), fileName: `${"ab".repeat(32)}.png`, mime: "image/png", base64: "cG5n" },
];
const META = { exportedAt: 1_800_000_000_000, appVersion: "0.1.0" };

describe("buildBackup / parseBackup", () => {
  it("round-trips through JSON", () => {
    const backup = buildBackup(sampleData(), MEDIA, { ...META, light: false });
    expect(backup).toMatchObject({ format: "fixa-backup", version: 1, ...META });
    expect(parseBackup(JSON.parse(JSON.stringify(backup)))).toEqual(backup);
  });

  it("round-trips any number of entities", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 5 }), (decks, logs) => {
        const data = sampleData();
        const preset = data.presets[0] as BackupData["presets"][0];
        data.decks = Array.from({ length: decks }, () => makeDeck({ presetId: preset.id }));
        data.reviewLogs = Array.from({ length: logs }, () => makeReviewLog());
        const backup = buildBackup(data, [], { ...META, light: false });
        expect(parseBackup(JSON.parse(JSON.stringify(backup)))).toEqual(backup);
      }),
      { numRuns: 25 },
    );
  });

  it("leaves out review history and media in a light backup", () => {
    const backup = buildBackup(sampleData(), MEDIA, { ...META, light: true });
    expect(backup.data.reviewLogs).toEqual([]);
    expect(backup.media).toEqual([]);
    expect(backup.data.cards).toHaveLength(1);
  });

  it("rejects files that are not Fixa backups", () => {
    expect(() => parseBackup({ format: "anki", version: 1 })).toThrow("not a Fixa backup");
    expect(() => parseBackup("hello")).toThrow("not a Fixa backup");
  });

  it("rejects backup versions it does not know", () => {
    const backup = buildBackup(sampleData(), [], { ...META, light: false });
    expect(() => parseBackup({ ...backup, version: 2 })).toThrow("unsupported backup version 2");
  });

  it("rejects invalid records, saying where", () => {
    const backup = buildBackup(sampleData(), [], { ...META, light: false });
    const broken = JSON.parse(JSON.stringify(backup));
    broken.data.cards[0].flag = 99;
    expect(() => parseBackup(broken)).toThrow(/data\.cards\.0/);
  });

  it("rejects invalid settings and media", () => {
    const backup = JSON.parse(
      JSON.stringify(buildBackup(sampleData(), MEDIA, { ...META, light: false })),
    );
    expect(() =>
      parseBackup({ ...backup, data: { ...backup.data, settings: { cutoffHour: 30 } } }),
    ).toThrow();
    expect(() => parseBackup({ ...backup, media: [{ ...MEDIA[0], id: "x" }] })).toThrow();
  });
});
