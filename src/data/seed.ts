import { type NoteType, noteTypeSchema, presetSchema } from "../domain/model";
import type { Clock } from "../domain/ports";
import type { FixaDb } from "./db";

/** Display names come from src/i18n (data never imports i18n — the app passes them in). */
export interface SeedLabels {
  presetName: string;
  basic: string;
  basicReversed: string;
  cloze: string;
  front: string;
  back: string;
  text: string;
  extra: string;
  card: (n: number) => string;
}

/** Fixed, well-known IDs (variant "a" never collides with generated UUIDv7s in tests). */
export const SEED_IDS = {
  preset: "00000000-0000-7000-a000-000000000001",
  basic: "00000000-0000-7000-a000-000000000002",
  basicReversed: "00000000-0000-7000-a000-000000000003",
  cloze: "00000000-0000-7000-a000-000000000004",
} as const;

const field = (id: string, name: string) => ({ id, name, sticky: false, rtl: false });
/** Anki-style back side: the front, a divider, then the answer field. */
const answerSide = (fieldName: string) => `{{FrontSide}}<hr id=answer>{{${fieldName}}}`;

function seedNoteTypes(
  l: SeedLabels,
): Array<Omit<NoteType, "createdAt" | "updatedAt" | "deletedAt">> {
  const basicFields = [field("front", l.front), field("back", l.back)];
  const card1 = { id: "card1", name: l.card(1), front: `{{${l.front}}}`, back: answerSide(l.back) };
  return [
    {
      id: SEED_IDS.basic,
      name: l.basic,
      kind: "standard",
      fields: basicFields,
      templates: [card1],
      css: "",
    },
    {
      id: SEED_IDS.basicReversed,
      name: l.basicReversed,
      kind: "standard",
      fields: basicFields,
      templates: [
        card1,
        { id: "card2", name: l.card(2), front: `{{${l.back}}}`, back: answerSide(l.front) },
      ],
      css: "",
    },
    {
      id: SEED_IDS.cloze,
      name: l.cloze,
      kind: "cloze",
      fields: [field("text", l.text), field("extra", l.extra)],
      templates: [
        {
          id: "cloze",
          name: l.cloze,
          front: `{{cloze:${l.text}}}`,
          back: `{{cloze:${l.text}}}<br>{{${l.extra}}}`,
        },
      ],
      css: "",
    },
  ];
}

/**
 * Creates the default preset and note types on first use. Idempotent: an entity that already
 * exists — even edited or soft-deleted by the user — is left untouched.
 */
export async function ensureSeed({ db, clock }: { db: FixaDb; clock: Clock }, labels: SeedLabels) {
  const now = clock.now();
  const stamps = { createdAt: now, updatedAt: now, deletedAt: null };
  await db.transaction("rw", db.presets, db.noteTypes, async () => {
    if (!(await db.presets.get(SEED_IDS.preset))) {
      await db.presets.add(
        presetSchema.parse({ id: SEED_IDS.preset, name: labels.presetName, ...stamps }),
      );
    }
    for (const nt of seedNoteTypes(labels)) {
      if (!(await db.noteTypes.get(nt.id)))
        await db.noteTypes.add(noteTypeSchema.parse({ ...nt, ...stamps }));
    }
  });
}
