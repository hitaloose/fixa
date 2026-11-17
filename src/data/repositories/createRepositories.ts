import { parseNoteType } from "../../domain/model";
import type { Clock, IdGenerator } from "../../domain/ports";
import type { FixaDb } from "../db";
import { createAnkiExportRepository } from "./ankiExport";
import { createAnkiImportRepository } from "./ankiImport";
import { createBackupRepository } from "./backup";
import { createBulkRepository } from "./bulk";
import { createCardsRepository } from "./cards";
import { createDecksRepository } from "./decks";
import { createEntityRepository } from "./entityRepository";
import { createMediaRepository } from "./media";
import { createNotesRepository } from "./notes";
import { createPresetsRepository } from "./presets";
import { createReviewLogsRepository } from "./reviewLogs";
import { createSettingsRepository } from "./settings";

export interface RepositoryDeps {
  db: FixaDb;
  clock: Clock;
  ids: IdGenerator;
}

export function createRepositories({ db, clock, ids }: RepositoryDeps) {
  const entity = { clock, ids };
  const media = createMediaRepository({ table: db.media });
  return {
    presets: createPresetsRepository({ db, ...entity }),
    decks: createDecksRepository({ db, ...entity }),
    noteTypes: createEntityRepository({ table: db.noteTypes, parse: parseNoteType, ...entity }),
    notes: createNotesRepository({ db, ...entity }),
    cards: createCardsRepository({ db, ...entity }),
    reviewLogs: createReviewLogsRepository({ table: db.reviewLogs, clock }),
    media,
    settings: createSettingsRepository({ table: db.settings }),
    bulk: createBulkRepository({ db, ...entity }),
    backup: createBackupRepository({ db, clock }),
    ankiImport: createAnkiImportRepository({ db, ...entity, media }),
    ankiExport: createAnkiExportRepository({ db, clock }),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
