import {
  cardSchema,
  deckSchema,
  noteSchema,
  noteTypeSchema,
  presetSchema,
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
    presets: createEntityRepository({ table: db.presets, schema: presetSchema, ...entity }),
    decks: createEntityRepository({ table: db.decks, schema: deckSchema, ...entity }),
    noteTypes: createEntityRepository({ table: db.noteTypes, schema: noteTypeSchema, ...entity }),
    notes: createEntityRepository({ table: db.notes, schema: noteSchema, ...entity }),
    cards: createEntityRepository({ table: db.cards, schema: cardSchema, ...entity }),
    reviewLogs: createReviewLogsRepository({ table: db.reviewLogs, clock }),
    media: createMediaRepository({ table: db.media }),
    settings: createSettingsRepository({ table: db.settings }),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
