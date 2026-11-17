/**
 * Anki collection → Fixa entities (docs/08-import-export.md › Mapeamento). Pure: the caller
 * reads the package, stores the media and passes what already exists so nothing is duplicated.
 */
import { z } from "zod";
import { buildDeckTree, type DeckNode } from "../../decks";
import {
  type Card,
  type Deck,
  defaultPresetValues,
  type Note,
  type NoteType,
  type Preset,
  type ReviewLog,
} from "../../model";
import { newCard, parseTags, plainText } from "../../notes";
import type { IdGenerator } from "../../ports";
import { answer, type Rating } from "../../scheduler";

const DAY_MS = 86_400_000;

// ---------- raw collection (validated) ----------

const loose = <T extends z.ZodRawShape>(shape: T) => z.looseObject(shape);
const json = <T extends z.ZodType>(schema: T) =>
  z.string().transform((text, ctx): z.output<T> => {
    try {
      return schema.parse(JSON.parse(text));
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "bad JSON",
      });
      return z.NEVER;
    }
  });

const modelSchema = loose({
  id: z.number(),
  name: z.string().min(1),
  type: z.number(),
  css: z.string().default(""),
  flds: z.array(
    loose({
      name: z.string().min(1),
      ord: z.number(),
      sticky: z.boolean().default(false),
      rtl: z.boolean().default(false),
    }),
  ),
  tmpls: z.array(
    loose({ name: z.string().min(1), ord: z.number(), qfmt: z.string(), afmt: z.string() }),
  ),
});
const deckSchema = loose({
  id: z.number(),
  name: z.string(),
  conf: z.number().optional(),
  dyn: z.number().default(0),
  collapsed: z.boolean().default(false),
});
const dconfSchema = loose({
  id: z.number(),
  name: z.string().min(1),
  new: loose({ perDay: z.number(), delays: z.array(z.number()) }),
  rev: loose({ perDay: z.number(), maxIvl: z.number() }),
  lapse: loose({ delays: z.array(z.number()), leechFails: z.number(), leechAction: z.number() }),
  desiredRetention: z.number().optional(),
});

const collectionSchema = z.object({
  col: z.object({
    crt: z.number(),
    models: json(z.record(z.string(), modelSchema)),
    decks: json(z.record(z.string(), deckSchema)),
    dconf: json(z.record(z.string(), dconfSchema)),
  }),
  notes: z.array(
    z.object({
      id: z.number(),
      guid: z.string().min(1),
      mid: z.number(),
      mod: z.number(),
      tags: z.string(),
      flds: z.string(),
    }),
  ),
  cards: z.array(
    z.object({
      id: z.number(),
      nid: z.number(),
      did: z.number(),
      ord: z.number(),
      mod: z.number(),
      type: z.number(),
      queue: z.number(),
      due: z.number(),
      ivl: z.number(),
      factor: z.number(),
      reps: z.number(),
      lapses: z.number(),
      left: z.number(),
      odid: z.number(),
      flags: z.number(),
      data: z.string(),
    }),
  ),
  revlog: z.array(
    z.object({
      id: z.number(),
      cid: z.number(),
      ease: z.number(),
      ivl: z.number(),
      time: z.number(),
      type: z.number(),
    }),
  ),
});

export type AnkiCollection = z.output<typeof collectionSchema>;
type AnkiModel = z.output<typeof modelSchema>;
type AnkiDconf = z.output<typeof dconfSchema>;
type AnkiCard = AnkiCollection["cards"][number];

/** Validates the rows read from the package; throws when it is not a usable collection. */
export function parseAnkiCollection(raw: unknown): AnkiCollection {
  return collectionSchema.parse(raw);
}

// ---------- plan ----------

export interface AnkiImportContext {
  now: number;
  ids: IdGenerator;
  /** Fixa's default preset: Anki's "Default" options map to it. */
  defaultPresetId: string;
  existingDecks: readonly Deck[];
  existingPresets: readonly Preset[];
  existingNoteTypes: readonly NoteType[];
  /** Guids of notes already in Fixa: those notes are skipped. */
  existingGuids: ReadonlySet<string>;
  /** Anki media name → stored file name (content-addressed). */
  mediaNames: ReadonlyMap<string, string>;
}

/** Notes come without checksum: hashing is IO, the caller adds it. */
export type PlannedNote = Omit<Note, "checksum">;

export interface AnkiImportPlan {
  presets: Preset[];
  decks: Deck[];
  noteTypes: NoteType[];
  notes: PlannedNote[];
  cards: Card[];
  reviewLogs: ReviewLog[];
  skippedNotes: number;
}

/** Anki delays are minutes; Fixa steps are "Nm", "Nh" or "Nd". */
function step(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  if (m % 1440 === 0) return `${m / 1440}d`;
  if (m % 60 === 0) return `${m / 60}h`;
  return `${m}m`;
}

/** Newer Anki versions separate deck levels with U+001F instead of "::". */
const UNIT_SEPARATOR = String.fromCharCode(0x1f);
const deckSegments = (name: string) =>
  name
    .replaceAll(UNIT_SEPARATOR, "::")
    .split("::")
    .map((s) => s.trim());

const norm = (s: string) => s.normalize("NFC").toLocaleLowerCase("pt-BR").trim();

const signature = (nt: Pick<NoteType, "name" | "kind" | "fields" | "templates">) =>
  JSON.stringify([
    nt.name,
    nt.kind,
    nt.fields.map((f) => f.name),
    nt.templates.map((t) => [t.front, t.back]),
  ]);

function rewriteMedia(html: string, names: ReadonlyMap<string, string>): string {
  return html
    .replace(/(<img\b[^>]*?\bsrc=)(["'])(.*?)\2/gi, (all, head: string, q: string, src: string) => {
      const renamed = names.get(src);
      return renamed ? `${head}${q}${renamed}${q}` : all;
    })
    .replace(/\[sound:([^\]]+)\]/g, (all, src: string) => {
      const renamed = names.get(src);
      return renamed ? `<audio controls src="${renamed}"></audio>` : all;
    });
}

function stepsFor(card: AnkiCard, dconf: AnkiDconf | undefined): number {
  const delays = card.type === 3 ? dconf?.lapse.delays : dconf?.new.delays;
  return delays?.length ?? 1;
}

export function planAnkiImport(collection: AnkiCollection, ctx: AnkiImportContext): AnkiImportPlan {
  const { col } = collection;
  const crtMs = col.crt * 1000;
  const stamps = (createdAt: number, modSeconds: number) => ({
    createdAt,
    updatedAt: Math.max(createdAt, modSeconds * 1000),
    deletedAt: null,
  });

  // Notes to import (skip those already in Fixa) and the cards that belong to them.
  const notesToImport = collection.notes.filter((n) => !ctx.existingGuids.has(n.guid));
  const importedNoteIds = new Set(notesToImport.map((n) => n.id));
  const cardsToImport = collection.cards.filter((c) => importedNoteIds.has(c.nid));
  const homeDeck = (c: AnkiCard) => (c.odid !== 0 ? c.odid : c.did);
  const usedDecks = new Set(cardsToImport.map(homeDeck));

  // Presets.
  const presets: Preset[] = [];
  const presetIdByConf = new Map<number, string>();
  const dconfs = new Map(Object.values(col.dconf).map((d) => [d.id, d]));
  const presetFor = (confId: number | undefined): string => {
    if (confId === undefined || confId === 1) return ctx.defaultPresetId;
    const known = presetIdByConf.get(confId);
    if (known) return known;
    const conf = dconfs.get(confId);
    if (!conf) return ctx.defaultPresetId;
    const existing = [...ctx.existingPresets, ...presets].find(
      (p) => norm(p.name) === norm(conf.name),
    );
    let id = existing?.id;
    if (!id) {
      id = ctx.ids.next();
      presets.push({
        ...defaultPresetValues(),
        id,
        name: conf.name,
        newPerDay: conf.new.perDay,
        reviewsPerDay: conf.rev.perDay,
        learningSteps: conf.new.delays.map(step),
        relearningSteps: conf.lapse.delays.map(step),
        maximumIntervalDays: Math.max(1, conf.rev.maxIvl),
        leechThreshold: Math.max(1, conf.lapse.leechFails),
        leechAction: conf.lapse.leechAction === 0 ? "suspend" : "tag",
        ...(conf.desiredRetention !== undefined
          ? { desiredRetention: Math.min(0.99, Math.max(0.7, conf.desiredRetention)) }
          : {}),
        createdAt: ctx.now,
        updatedAt: ctx.now,
        deletedAt: null,
      });
    }
    presetIdByConf.set(confId, id);
    return id;
  };

  // Decks: every used deck and its ancestors, reusing existing paths.
  const decks: Deck[] = [];
  const deckIdByAnki = new Map<number, string>();
  const ankiDecks = Object.values(col.decks).filter((d) => d.dyn === 0);
  const ankiByPath = new Map(ankiDecks.map((d) => [deckSegments(d.name).join("::"), d]));
  const pathIndex = () => {
    const flat = (nodes: DeckNode[]): DeckNode[] => nodes.flatMap((n) => [n, ...flat(n.children)]);
    return new Map(
      flat(buildDeckTree([...ctx.existingDecks, ...decks])).map((n) => [norm(n.path), n.deck.id]),
    );
  };
  for (const anki of ankiDecks) {
    if (!usedDecks.has(anki.id)) continue;
    const segments = deckSegments(anki.name);
    let parentId: string | null = null;
    for (let i = 0; i < segments.length; i++) {
      const path = segments.slice(0, i + 1).join("::");
      const found = pathIndex().get(norm(path));
      if (found) {
        parentId = found;
        continue;
      }
      const source = ankiByPath.get(path);
      const id = ctx.ids.next();
      decks.push({
        id,
        name: segments[i] as string,
        parentId,
        presetId: presetFor(source?.conf),
        description: "",
        collapsed: source?.collapsed ?? false,
        overrides: {},
        position: 0,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        deletedAt: null,
      });
      parentId = id;
    }
    if (parentId) deckIdByAnki.set(anki.id, parentId);
  }
  const ankiDeckConf = new Map(ankiDecks.map((d) => [d.id, d.conf]));
  const deckPresetId = (deckId: string) =>
    [...ctx.existingDecks, ...decks].find((d) => d.id === deckId)?.presetId ?? ctx.defaultPresetId;
  const allPresets = () => [...ctx.existingPresets, ...presets];

  // Note types.
  const noteTypes: NoteType[] = [];
  const noteTypeByModel = new Map<number, NoteType>();
  const usedModels = new Set(notesToImport.map((n) => n.mid));
  for (const model of Object.values(col.models) as AnkiModel[]) {
    if (!usedModels.has(model.id)) continue;
    const draft = {
      name: model.name,
      kind: model.type === 1 ? ("cloze" as const) : ("standard" as const),
      fields: [...model.flds]
        .sort((a, b) => a.ord - b.ord)
        .map((f) => ({ id: `f${f.ord}`, name: f.name, sticky: f.sticky, rtl: f.rtl })),
      templates: [...model.tmpls]
        .sort((a, b) => a.ord - b.ord)
        .slice(0, model.type === 1 ? 1 : undefined)
        .map((t) => ({ id: `t${t.ord}`, name: t.name, front: t.qfmt, back: t.afmt })),
      css: model.css,
    };
    const same = [...ctx.existingNoteTypes, ...noteTypes].find(
      (nt) => signature(nt) === signature(draft),
    );
    const noteType = same ?? {
      ...draft,
      id: ctx.ids.next(),
      createdAt: ctx.now,
      updatedAt: ctx.now,
      deletedAt: null,
    };
    if (!same) noteTypes.push(noteType);
    noteTypeByModel.set(model.id, noteType);
  }

  // Notes.
  const notes: PlannedNote[] = [];
  const noteIdByAnki = new Map<number, string>();
  for (const raw of notesToImport) {
    const noteType = noteTypeByModel.get(raw.mid);
    if (!noteType) continue;
    const values = raw.flds.split(UNIT_SEPARATOR);
    const fields = Object.fromEntries(
      noteType.fields.map((f, i) => [f.id, rewriteMedia(values[i] ?? "", ctx.mediaNames)]),
    );
    const id = ctx.ids.next();
    noteIdByAnki.set(raw.id, id);
    notes.push({
      id,
      noteTypeId: noteType.id,
      fields,
      tags: parseTags(raw.tags),
      sortField: plainText(fields[noteType.fields[0]?.id ?? ""] ?? ""),
      guid: raw.guid,
      ...stamps(raw.id, raw.mod),
    });
  }

  // Cards and their history.
  const cards: Card[] = [];
  const reviewLogs: ReviewLog[] = [];
  const answers = new Map<number, AnkiCollection["revlog"]>();
  for (const log of collection.revlog) {
    if (log.ease < 1 || log.ease > 4 || log.type > 3) continue; // manual / rescheduling entries
    answers.set(log.cid, [...(answers.get(log.cid) ?? []), log]);
  }

  for (const raw of cardsToImport) {
    const noteId = noteIdByAnki.get(raw.nid);
    const deckId = deckIdByAnki.get(homeDeck(raw));
    if (!noteId || !deckId) continue;
    const id = ctx.ids.next();
    const fresh = newCard({ id, noteId, deckId, templateOrd: raw.ord, now: raw.id });
    const presetId = deckPresetId(deckId);
    const preset = allPresets().find((p) => p.id === presetId);
    const history = (answers.get(raw.id) ?? []).sort((a, b) => a.id - b.id);

    // Replay the history with FSRS (leeches never suspend during a replay).
    let simulated: Card = fresh;
    if (preset) {
      const replayPreset = { ...preset, leechThreshold: Number.MAX_SAFE_INTEGER };
      for (const log of history) {
        const result = answer({
          card: simulated,
          rating: log.ease as Rating,
          now: log.id,
          preset: replayPreset,
          durationMs: log.time,
          logId: ctx.ids.next(),
        });
        simulated = result.nextCard;
        reviewLogs.push({ ...result.reviewLog, cardId: id });
      }
    }

    const ankiState = (["new", "learning", "review", "relearning"] as const)[raw.type] ?? "new";
    const timed = raw.due > 1_000_000_000; // learning cards: epoch seconds; otherwise collection days
    const due = timed ? raw.due * 1000 : crtMs + raw.due * DAY_MS;
    const memory = (() => {
      try {
        const data = raw.data ? (JSON.parse(raw.data) as { s?: number; d?: number }) : {};
        if (typeof data.s === "number" && typeof data.d === "number")
          return { stability: data.s, difficulty: data.d };
      } catch {
        // not FSRS data
      }
      if (history.length > 0)
        return { stability: simulated.stability, difficulty: simulated.difficulty };
      return { stability: Math.max(raw.ivl, 0.5), difficulty: 5 };
    })();

    let card: Card;
    if (ankiState === "new") {
      card = { ...fresh, newPosition: crtMs + raw.due, due: fresh.createdAt };
    } else {
      const steps = stepsFor(raw, dconfs.get(ankiDeckConf.get(homeDeck(raw)) ?? 1));
      const lastReview =
        history.at(-1)?.id ?? (ankiState === "review" ? due - raw.ivl * DAY_MS : raw.mod * 1000);
      card = {
        ...fresh,
        state: ankiState,
        queue: ankiState,
        due,
        ...memory,
        scheduledDays: ankiState === "review" ? raw.ivl : 0,
        elapsedDays: 0,
        learningStep:
          ankiState === "review" ? 0 : Math.min(steps - 1, Math.max(0, steps - (raw.left % 1000))),
        reps: raw.reps,
        lapses: raw.lapses,
        lastReviewAt: lastReview,
      };
    }
    cards.push({
      ...card,
      queue: raw.queue === -1 ? "suspended" : card.state,
      buriedUntilDay: null,
      flag: raw.flags & 7,
      ...stamps(raw.id, raw.mod),
    });
  }

  return {
    presets,
    decks,
    noteTypes,
    notes,
    cards,
    reviewLogs,
    skippedNotes: collection.notes.length - notesToImport.length,
  };
}
