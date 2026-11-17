/**
 * Backup merge (docs/06-dados-e-backup.md › Mesclar). Commutative: merging A into B and B into
 * A give the same records. Per record the newer `updatedAt` wins (ties broken by content, so
 * the choice never depends on the side); review logs are a union by id where an undo wins;
 * a card whose review history changed is rebuilt by replaying the merged logs.
 */
import type { Card, Preset, ReviewLog } from "../model";
import { replay } from "../scheduler";
import type { BackupData } from "./format";

export type MergedData = Omit<BackupData, "settings">;

interface Versioned {
  id: string;
  updatedAt: number;
}

type Side = "local" | "incoming";

function newer<T extends Versioned>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

/** Merged records plus, for each id, the side whose version won. */
function mergeRecords<T extends Versioned>(local: readonly T[], incoming: readonly T[]) {
  const winners = new Map<string, { record: T; side: Side }>();
  for (const record of local) winners.set(record.id, { record, side: "local" });
  for (const record of incoming) {
    const current = winners.get(record.id);
    if (!current) winners.set(record.id, { record, side: "incoming" });
    else if (newer(current.record, record) === record && current.record !== record) {
      winners.set(record.id, { record, side: "incoming" });
    }
  }
  return winners;
}

/** Same log from both sides: an undo wins (the earliest one if both were undone). */
function mergeLog(a: ReviewLog, b: ReviewLog): ReviewLog {
  if (a.undoneAt === null && b.undoneAt === null) {
    return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
  }
  if (a.undoneAt === null) return b;
  if (b.undoneAt === null) return a;
  return a.undoneAt <= b.undoneAt ? a : b;
}

const historyKey = (logs: readonly ReviewLog[]) =>
  logs
    .map((l) => `${l.id}:${l.undoneAt ?? ""}`)
    .sort()
    .join("|");

export function mergeBackup(local: BackupData, incoming: BackupData): MergedData {
  const logsById = new Map<string, ReviewLog>();
  for (const log of [...local.reviewLogs, ...incoming.reviewLogs]) {
    const seen = logsById.get(log.id);
    logsById.set(log.id, seen ? mergeLog(seen, log) : log);
  }
  const reviewLogs = [...logsById.values()];

  const byCard = (logs: readonly ReviewLog[]) => {
    const map = new Map<string, ReviewLog[]>();
    for (const l of logs) map.set(l.cardId, [...(map.get(l.cardId) ?? []), l]);
    return map;
  };
  const mergedHistory = byCard(reviewLogs);
  const history = { local: byCard(local.reviewLogs), incoming: byCard(incoming.reviewLogs) };

  const presets = [...mergeRecords(local.presets, incoming.presets).values()].map((w) => w.record);
  const decks = [...mergeRecords(local.decks, incoming.decks).values()].map((w) => w.record);
  const presetById = new Map(presets.map((p) => [p.id, p]));
  const presetOfDeck = new Map(decks.map((d) => [d.id, presetById.get(d.presetId)]));

  const cards: Card[] = [...mergeRecords(local.cards, incoming.cards).values()].map(
    ({ record, side }) => {
      const merged = mergedHistory.get(record.id) ?? [];
      const own = history[side].get(record.id) ?? [];
      const preset: Preset | undefined = presetOfDeck.get(record.deckId);
      if (merged.length === 0 || !preset || historyKey(merged) === historyKey(own)) return record;
      return replay(record, merged, preset);
    },
  );

  return {
    presets,
    decks,
    noteTypes: [...mergeRecords(local.noteTypes, incoming.noteTypes).values()].map((w) => w.record),
    notes: [...mergeRecords(local.notes, incoming.notes).values()].map((w) => w.record),
    cards,
    reviewLogs,
  };
}
