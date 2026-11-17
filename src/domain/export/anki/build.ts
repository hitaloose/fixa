/**
 * Fixa → Anki legacy collection (docs/08-import-export.md › Exportar .apkg): the rows of a
 * "collection.anki21" plus the media list. Pure; hashing (csum) and SQLite are done outside.
 */
import { deckPath } from "../../decks";
import type { Card, Deck, Note, NoteType, Preset, ReviewLog } from "../../model";
import { plainText } from "../../notes";

const DAY_MS = 86_400_000;
const SEPARATOR = String.fromCharCode(0x1f);

export interface AnkiExportInput {
  decks: Deck[];
  presets: Preset[];
  noteTypes: NoteType[];
  notes: Note[];
  cards: Card[];
  reviewLogs: ReviewLog[];
  now: number;
}

export interface AnkiExport {
  col: { crt: number; models: string; decks: string; dconf: string };
  notes: Array<{
    id: number;
    guid: string;
    mid: number;
    mod: number;
    tags: string;
    flds: string;
    sfld: string;
  }>;
  cards: Array<{
    id: number;
    nid: number;
    did: number;
    ord: number;
    mod: number;
    type: number;
    queue: number;
    due: number;
    ivl: number;
    factor: number;
    reps: number;
    lapses: number;
    left: number;
    odid: number;
    flags: number;
    data: string;
  }>;
  revlog: Array<{
    id: number;
    cid: number;
    ease: number;
    ivl: number;
    lastIvl: number;
    factor: number;
    time: number;
    type: number;
  }>;
  /** Media file names referenced by the exported notes, in order. */
  media: string[];
}

/** Anki ids are integers (usually ms timestamps): derive them from creation time, unique. */
function idAllocator(start = 1) {
  const used = new Set<number>([1]);
  return (wanted: number) => {
    let id = Math.max(start, Math.floor(wanted));
    while (used.has(id)) id++;
    used.add(id);
    return id;
  };
}

const minutes = (step: string): number => {
  const n = Number(step.slice(0, -1));
  const unit = step.at(-1);
  return unit === "d" ? n * 1440 : unit === "h" ? n * 60 : n;
};

const AUDIO = /<audio\b[^>]*?\bsrc=(["'])(.*?)\1[^>]*>\s*<\/audio>/gi;
const MEDIA_REF = /<img\b[^>]*?\bsrc=(["'])(.*?)\1|\[sound:([^\]]+)\]/gi;

function dconfJson(
  id: number,
  name: string,
  p: Pick<
    Preset,
    | "newPerDay"
    | "reviewsPerDay"
    | "learningSteps"
    | "relearningSteps"
    | "maximumIntervalDays"
    | "leechThreshold"
    | "leechAction"
    | "buryNewSiblings"
    | "buryReviewSiblings"
    | "autoplayAudio"
    | "showTimer"
    | "desiredRetention"
  >,
  mod: number,
) {
  return {
    id,
    name,
    mod,
    usn: -1,
    maxTaken: 60,
    autoplay: p.autoplayAudio,
    timer: p.showTimer ? 1 : 0,
    replayq: true,
    dyn: false,
    new: {
      perDay: p.newPerDay,
      delays: p.learningSteps.map(minutes),
      ints: [1, 4, 0],
      initialFactor: 2500,
      order: 1,
      bury: p.buryNewSiblings,
    },
    rev: {
      perDay: p.reviewsPerDay,
      maxIvl: p.maximumIntervalDays,
      ease4: 1.3,
      hardFactor: 1.2,
      ivlFct: 1,
      bury: p.buryReviewSiblings,
    },
    lapse: {
      delays: p.relearningSteps.map(minutes),
      leechFails: p.leechThreshold,
      leechAction: p.leechAction === "suspend" ? 0 : 1,
      minInt: 1,
      mult: 0,
    },
    desiredRetention: p.desiredRetention,
  };
}

export function buildAnkiExport(input: AnkiExportInput): AnkiExport {
  const { now } = input;
  const earliest = Math.min(
    now,
    ...input.cards.map((c) => c.createdAt),
    ...input.notes.map((n) => n.createdAt),
  );
  const crt = Math.floor(earliest / DAY_MS) * 86_400;
  const crtMs = crt * 1000;
  const sec = (ms: number) => Math.floor(ms / 1000);

  // Options: "1" is Anki's Default (needed by the Default deck); each preset gets its own id.
  const confId = idAllocator(2);
  const dconf: Record<string, unknown> = {
    1: dconfJson(
      1,
      "Default",
      {
        newPerDay: 20,
        reviewsPerDay: 200,
        learningSteps: ["1m", "10m"],
        relearningSteps: ["10m"],
        maximumIntervalDays: 36_500,
        leechThreshold: 8,
        leechAction: "tag",
        buryNewSiblings: true,
        buryReviewSiblings: false,
        autoplayAudio: true,
        showTimer: false,
        desiredRetention: 0.9,
      },
      sec(now),
    ),
  };
  const confByPreset = new Map<string, number>();
  for (const p of input.presets) {
    const id = confId(p.createdAt);
    confByPreset.set(p.id, id);
    dconf[id] = dconfJson(id, p.name, p, sec(p.updatedAt));
  }

  // Decks with full "::" paths; Anki always has the Default deck (id 1).
  const deckId = idAllocator(2);
  const decks: Record<string, unknown> = {
    1: {
      id: 1,
      name: "Default",
      conf: 1,
      dyn: 0,
      collapsed: false,
      desc: "",
      mod: sec(now),
      usn: -1,
      newToday: [0, 0],
      revToday: [0, 0],
      lrnToday: [0, 0],
      timeToday: [0, 0],
      extendNew: 10,
      extendRev: 50,
    },
  };
  const ankiDeck = new Map<string, number>();
  for (const d of input.decks) {
    const id = deckId(d.createdAt);
    ankiDeck.set(d.id, id);
    decks[id] = {
      id,
      name: deckPath(d.id, input.decks),
      conf: confByPreset.get(d.presetId) ?? 1,
      dyn: 0,
      collapsed: d.collapsed,
      desc: d.description,
      mod: sec(d.updatedAt),
      usn: -1,
      newToday: [0, 0],
      revToday: [0, 0],
      lrnToday: [0, 0],
      timeToday: [0, 0],
      extendNew: 10,
      extendRev: 50,
    };
  }

  // Note types.
  const modelId = idAllocator(1_000);
  const models: Record<string, unknown> = {};
  const ankiModel = new Map<string, number>();
  for (const nt of input.noteTypes) {
    const id = modelId(nt.createdAt);
    ankiModel.set(nt.id, id);
    models[id] = {
      id,
      name: nt.name,
      type: nt.kind === "cloze" ? 1 : 0,
      mod: sec(nt.updatedAt),
      usn: -1,
      sortf: 0,
      did: 1,
      flds: nt.fields.map((f, ord) => ({
        name: f.name,
        ord,
        sticky: f.sticky,
        rtl: f.rtl,
        font: "Arial",
        size: 20,
        media: [],
      })),
      tmpls: nt.templates.map((t, ord) => ({
        name: t.name,
        ord,
        qfmt: t.front,
        afmt: t.back,
        did: null,
        bqfmt: "",
        bafmt: "",
      })),
      req: nt.templates.map((t, ord) => [
        ord,
        "any",
        nt.fields.flatMap((f, i) => (t.front.includes(f.name) ? [i] : [])),
      ]),
      css: nt.css,
      latexPre:
        "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n",
      latexPost: "\\end{document}",
      tags: [],
      vers: [],
    };
  }

  // Notes.
  const noteId = idAllocator(1_000);
  const ankiNote = new Map<string, number>();
  const media: string[] = [];
  const noteTypeById = new Map(input.noteTypes.map((nt) => [nt.id, nt]));
  const notes: AnkiExport["notes"] = [];
  for (const n of input.notes) {
    const nt = noteTypeById.get(n.noteTypeId);
    const mid = ankiModel.get(n.noteTypeId);
    if (!nt || mid === undefined) continue;
    const id = noteId(n.createdAt);
    ankiNote.set(n.id, id);
    const values = nt.fields.map((f) =>
      (n.fields[f.id] ?? "").replace(AUDIO, (_all, _q, src: string) => `[sound:${src}]`),
    );
    for (const value of values) {
      for (const m of value.matchAll(MEDIA_REF)) {
        const name = m[2] ?? m[3];
        if (name && !media.includes(name)) media.push(name);
      }
    }
    notes.push({
      id,
      guid: n.guid ?? n.id.replace(/-/g, "").slice(-10),
      mid,
      mod: sec(n.updatedAt),
      tags: n.tags.length > 0 ? ` ${n.tags.join(" ")} ` : "",
      flds: values.join(SEPARATOR),
      sfld: plainText(values[0] ?? ""),
    });
  }

  // Cards: Anki's type (FSRS state) and queue, due as position / epoch seconds / collection day.
  const presetByDeck = new Map(
    input.decks.map((d) => [d.id, input.presets.find((p) => p.id === d.presetId)]),
  );
  const newRank = new Map(
    input.cards
      .filter((c) => c.state === "new")
      .sort((a, b) => a.newPosition - b.newPosition)
      .map((c, i) => [c.id, i + 1]),
  );
  const cardId = idAllocator(1_000);
  const ankiCard = new Map<string, number>();
  const cards: AnkiExport["cards"] = [];
  for (const c of input.cards) {
    const nid = ankiNote.get(c.noteId);
    const did = ankiDeck.get(c.deckId);
    if (nid === undefined || did === undefined) continue;
    const id = cardId(c.createdAt);
    ankiCard.set(c.id, id);
    const type = { new: 0, learning: 1, review: 2, relearning: 3 }[c.state];
    const active = c.state === "relearning" ? 1 : type;
    const queue = c.queue === "suspended" ? -1 : c.queue === "buried" ? -2 : active;
    const due =
      c.state === "new"
        ? (newRank.get(c.id) ?? 0)
        : c.state === "review"
          ? Math.floor((c.due - crtMs) / DAY_MS)
          : sec(c.due);
    const steps =
      (c.state === "relearning"
        ? presetByDeck.get(c.deckId)?.relearningSteps
        : presetByDeck.get(c.deckId)?.learningSteps
      )?.length ?? 1;
    const remaining = Math.max(1, steps - c.learningStep);
    cards.push({
      id,
      nid,
      did,
      ord: c.templateOrd,
      mod: sec(c.updatedAt),
      type,
      queue,
      due,
      ivl: c.state === "review" ? c.scheduledDays : 0,
      factor: c.state === "new" ? 0 : 2500,
      reps: c.reps,
      lapses: c.lapses,
      left: c.state === "learning" || c.state === "relearning" ? remaining * 1000 + remaining : 0,
      odid: 0,
      flags: c.flag,
      data: c.state === "new" ? "" : JSON.stringify({ s: c.stability, d: c.difficulty }),
    });
  }

  // History: answers only, undone ones left out.
  const revlogId = idAllocator(1_000);
  const revlog: AnkiExport["revlog"] = input.reviewLogs
    .filter((l) => l.kind === "review" && l.undoneAt === null && ankiCard.has(l.cardId))
    .sort((a, b) => a.reviewedAt - b.reviewedAt)
    .map((l) => ({
      id: revlogId(l.reviewedAt),
      cid: ankiCard.get(l.cardId) as number,
      ease: l.rating,
      ivl: l.scheduledDays,
      lastIvl: 0,
      factor: 2500,
      time: l.durationMs,
      type: l.stateBefore === "review" ? 1 : l.stateBefore === "relearning" ? 2 : 0,
    }));

  return {
    col: {
      crt,
      models: JSON.stringify(models),
      decks: JSON.stringify(decks),
      dconf: JSON.stringify(dconf),
    },
    notes,
    cards,
    revlog,
    media,
  };
}
