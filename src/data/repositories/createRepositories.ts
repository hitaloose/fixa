import {
  type Preset,
  type PresetInput,
  parseCard,
  parseDeck,
  parseNote,
  parseNoteType,
  parsePreset,
} from "../../domain/model";
import type { Clock, IdGenerator } from "../../domain/ports";
import type { FixaDb } from "../db";
import { createEntityRepository } from "./entityRepository";
import { createMediaRepository } from "./media";
import { createReviewLogsRepository } from "./reviewLogs";
import { createSettingsRepository } from "./settings";

export interface RepositoryDeps {
  db: FixaDb;
  clock: Clock;
  ids: IdGenerator;
}

export function createRepositories({ db, clock, ids }: RepositoryDeps) {
  const entity = { clock, ids };
  return {
    presets: createEntityRepository<Preset, PresetInput>({
      table: db.presets,
      parse: parsePreset,
      ...entity,
    }),
    decks: createEntityRepository({ table: db.decks, parse: parseDeck, ...entity }),
    noteTypes: createEntityRepository({ table: db.noteTypes, parse: parseNoteType, ...entity }),
    notes: createEntityRepository({ table: db.notes, parse: parseNote, ...entity }),
    cards: createEntityRepository({ table: db.cards, parse: parseCard, ...entity }),
    reviewLogs: createReviewLogsRepository({ table: db.reviewLogs, clock }),
    media: createMediaRepository({ table: db.media }),
    settings: createSettingsRepository({ table: db.settings }),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
