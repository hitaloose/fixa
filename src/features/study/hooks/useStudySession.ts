import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { runtime } from "../../../data/runtime";
import { endOfStudyDay, startOfStudyDay, studyDay } from "../../../domain/day";
import { subtreeIds } from "../../../domain/decks";
import type { Card, Note, NoteType, Preset } from "../../../domain/model";
import {
  buryCard,
  forgottenToday,
  reviewAhead,
  setFlag,
  studyByTag,
  suspendCard,
} from "../../../domain/queue";
import type { Rating } from "../../../domain/scheduler";
import { t } from "../../../i18n/pt-BR";
import {
  type AnswerChange,
  answerCard,
  replaceCard,
  type SessionData,
  undoAnswer,
  upNext,
} from "../model/session";

const UNDO_LIMIT = 20;
const LEECH_TAG = "leech";

type UndoEntry =
  | { kind: "answer"; change: AnswerChange; taggedLeech: boolean }
  | { kind: "card"; before: Card };

interface Loaded {
  data: SessionData;
  notes: Map<string, Note>;
  noteTypes: Map<string, NoteType>;
  haptics: boolean;
}

interface State {
  /** undefined while loading, null when the deck does not exist. */
  loaded: Loaded | null | undefined;
  revealed: boolean;
  shownAt: number;
  undo: UndoEntry[];
  toast: string | null;
  /** Bumped to rebuild the queue when time passes (learning cards coming due). */
  tick: number;
}

/** A custom study session (docs/01 › Estudo personalizado). */
export type CustomStudy =
  | { kind: "forgotten" }
  | { kind: "tag"; tag: string }
  | { kind: "ahead"; days: number };

async function loadSession(deckId: string, custom: CustomStudy | null): Promise<Loaded | null> {
  const { repos, clock, timeZone } = runtime();
  const now = clock.now();
  const cutoffHour = await repos.settings.get("cutoffHour");
  await repos.cards.releaseBuried(studyDay(now, cutoffHour, timeZone));
  const decks = await repos.decks.listActive();
  if (!decks.some((d) => d.id === deckId)) return null;
  const [presets, cards, logsToday, noteTypes, haptics] = await Promise.all([
    repos.presets.listActive(),
    repos.cards.inDecks(subtreeIds(deckId, decks)),
    repos.reviewLogs.since(startOfStudyDay(now, cutoffHour, timeZone)),
    repos.noteTypes.listActive(),
    repos.settings.get("haptics"),
  ]);
  const notes = await repos.notes.getMany([...new Set(cards.map((c) => c.noteId))]);
  const cardIds = !custom
    ? null
    : custom.kind === "forgotten"
      ? forgottenToday(cards, logsToday, startOfStudyDay(now, cutoffHour, timeZone))
      : custom.kind === "tag"
        ? studyByTag(cards, notes, custom.tag)
        : reviewAhead(cards, endOfStudyDay(now, cutoffHour, timeZone), custom.days);
  return {
    data: {
      rootDeckId: deckId,
      decks,
      presets,
      cards,
      logsToday,
      cutoffHour,
      timeZone,
      pinnedId: null,
      custom: cardIds ? { cardIds, answered: [] } : null,
    },
    notes: new Map(notes.map((n) => [n.id, n])),
    noteTypes: new Map(noteTypes.map((nt) => [nt.id, nt])),
    haptics,
  };
}

export interface StudyCard {
  card: Card;
  note: Note | undefined;
  noteType: NoteType | undefined;
  preset: Preset;
}

/** Study session for a deck: in-memory queue, persisted answers, undo stack (docs/05). */
export function useStudySession(deckId: string, custom: CustomStudy | null = null) {
  const customKey = JSON.stringify(custom);
  const state = useRef<State>({
    loaded: undefined,
    revealed: false,
    shownAt: 0,
    undo: [],
    toast: null,
    tick: 0,
  });
  const [version, rerender] = useReducer((x: number) => x + 1, 0);
  const writes = useRef<Promise<void>>(Promise.resolve());
  /** Answers in this session, and whether the automatic backup already ran for them. */
  const backup = useRef({ answers: 0, ran: false });

  const update = useCallback((patch: Partial<State>) => {
    Object.assign(state.current, patch);
    rerender();
  }, []);

  /** Writes run one after another so an undo never overtakes the answer it reverts. */
  const persist = useCallback(
    (write: () => Promise<unknown>) => {
      writes.current = writes.current.then(write).then(
        () => {},
        () => update({ toast: t.study.saveFailed }),
      );
    },
    [update],
  );

  useEffect(() => {
    let cancelled = false;
    void loadSession(deckId, JSON.parse(customKey) as CustomStudy | null).then((loaded) => {
      if (!cancelled) update({ loaded, shownAt: runtime().clock.now() });
    });
    return () => {
      cancelled = true;
    };
  }, [deckId, customKey, update]);

  const s = state.current;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the queue is rebuilt on every change (version) and when time passes (tick)
  const next = useMemo(
    () => (s.loaded ? upNext(s.loaded.data, runtime().clock.now()) : null),
    [version, s.loaded, s.tick],
  );

  const waitUntil = next?.waitUntil ?? null;

  // Automatic backup (docs/06): once the session is over, or when leaving it after answering.
  const runBackup = useCallback(() => {
    if (backup.current.answers === 0 || backup.current.ran) return;
    backup.current.ran = true;
    void writes.current.then(() => runtime().repos.autoBackup.runIfConfigured(__APP_VERSION__));
  }, []);
  const finished =
    s.loaded != null && next !== null && next.card === null && next.waitUntil === null;
  useEffect(() => {
    if (finished) runBackup();
  }, [finished, runBackup]);
  useEffect(() => runBackup, [runBackup]);
  useEffect(() => {
    if (waitUntil === null) return;
    const delay = Math.max(0, waitUntil - runtime().clock.now());
    const timer = setTimeout(() => update({ tick: state.current.tick + 1 }), delay);
    return () => clearTimeout(timer);
  }, [waitUntil, update]);

  const current: StudyCard | null = useMemo(() => {
    const loaded = s.loaded;
    const card = next?.card;
    if (!loaded || !card) return null;
    const note = loaded.notes.get(card.noteId);
    const deck = loaded.data.decks.find((d) => d.id === card.deckId);
    const preset = loaded.data.presets.find((p) => p.id === deck?.presetId);
    if (!preset) return null;
    return {
      card,
      note,
      noteType: note ? loaded.noteTypes.get(note.noteTypeId) : undefined,
      preset,
    };
  }, [next, s.loaded]);

  const pushUndo = (entry: UndoEntry) => [...state.current.undo, entry].slice(-UNDO_LIMIT);

  const answer = (rating: Rating) => {
    const { loaded, revealed, shownAt } = state.current;
    if (!loaded || !current || !revealed) return;
    const { clock, ids, repos } = runtime();
    const now = clock.now();
    const { data, change } = answerCard(loaded.data, {
      cardId: current.card.id,
      rating,
      now,
      durationMs: now - shownAt,
      logId: ids.next(),
    });
    const note = current.note;
    const taggedLeech = change.leech === "tag" && !!note && !note.tags.includes(LEECH_TAG);
    const notes =
      taggedLeech && note
        ? new Map(loaded.notes).set(note.id, { ...note, tags: [...note.tags, LEECH_TAG] })
        : loaded.notes;
    if (loaded.haptics && typeof navigator.vibrate === "function") navigator.vibrate(10);
    backup.current = { answers: backup.current.answers + 1, ran: false };
    update({
      loaded: { ...loaded, data, notes },
      revealed: false,
      shownAt: now,
      undo: pushUndo({ kind: "answer", change, taggedLeech }),
      toast:
        change.leech === "tag"
          ? t.study.leechTagged
          : change.leech === "suspend"
            ? t.study.leechSuspended
            : state.current.toast,
    });
    persist(() =>
      repos.cards.applyAnswer({
        card: change.card,
        log: change.log,
        buried: change.buried,
        tagLeech: taggedLeech,
      }),
    );
  };

  /** `leaves` = the card leaves the queue (bury/suspend), so the next one starts fresh. */
  const changeCard = (changed: Card, toast: string | null, leaves: boolean) => {
    const { loaded } = state.current;
    if (!loaded || !current) return;
    update({
      loaded: { ...loaded, data: replaceCard(loaded.data, changed) },
      ...(leaves ? { revealed: false, shownAt: runtime().clock.now() } : {}),
      undo: pushUndo({ kind: "card", before: current.card }),
      toast: toast ?? state.current.toast,
    });
    persist(() => runtime().repos.cards.save(changed));
  };

  const today = () => {
    const { loaded } = state.current;
    const { clock, timeZone } = runtime();
    return studyDay(clock.now(), loaded?.data.cutoffHour ?? 4, timeZone);
  };

  const undo = () => {
    const { loaded, undo: stack } = state.current;
    const entry = stack[stack.length - 1];
    if (!loaded || !entry) return;
    const { clock, repos } = runtime();
    const now = clock.now();
    let data: SessionData;
    let notes = loaded.notes;
    if (entry.kind === "answer") {
      const { change, taggedLeech } = entry;
      data = undoAnswer(loaded.data, change, now);
      const note = notes.get(change.before.noteId);
      if (taggedLeech && note) {
        notes = new Map(notes).set(note.id, {
          ...note,
          tags: note.tags.filter((tag) => tag !== LEECH_TAG),
        });
      }
      persist(() =>
        repos.cards.undoAnswer({
          before: change.before,
          buriedBefore: change.buriedBefore,
          logId: change.log.id,
          untagLeech: taggedLeech,
        }),
      );
    } else {
      data = { ...replaceCard(loaded.data, entry.before), pinnedId: entry.before.id };
      persist(() => repos.cards.save(entry.before));
    }
    update({
      loaded: { ...loaded, data, notes },
      revealed: false,
      shownAt: now,
      undo: stack.slice(0, -1),
    });
  };

  return {
    status: s.loaded === undefined ? "loading" : s.loaded === null ? "not-found" : "ready",
    current,
    counts: next?.counts ?? { new: 0, learning: 0, review: 0 },
    waitUntil,
    revealed: s.revealed,
    shownAt: s.shownAt,
    canUndo: s.undo.length > 0,
    toast: s.toast,
    reveal: () => {
      if (state.current.loaded && current) update({ revealed: true });
    },
    answer,
    undo,
    bury: () =>
      current &&
      changeCard(buryCard(current.card, today(), runtime().clock.now()), t.study.buried, true),
    suspend: () =>
      current &&
      changeCard(suspendCard(current.card, runtime().clock.now()), t.study.suspended, true),
    flag: (flag: number) =>
      current && changeCard(setFlag(current.card, flag, runtime().clock.now()), null, false),
    dismissToast: () => update({ toast: null }),
  } as const;
}

export type StudySession = ReturnType<typeof useStudySession>;
