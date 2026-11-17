import type { AnkiMediaFile } from "../../../data/repositories";
import { runtime } from "../../../data/runtime";

export function useAnkiImport() {
  return (collection: unknown, media: readonly AnkiMediaFile[]) =>
    runtime().repos.ankiImport.importCollection(collection, media);
}
