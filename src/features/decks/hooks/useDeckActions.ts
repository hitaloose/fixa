import { type DeckErrorCode, DeckOperationError } from "../../../data/repositories";
import { runtime } from "../../../data/runtime";
import { SEED_IDS } from "../../../data/seed";

/** Resolves to null on success, or the error code to show. */
async function attempt(op: () => Promise<unknown>): Promise<DeckErrorCode | null> {
  try {
    await op();
    return null;
  } catch (error) {
    if (error instanceof DeckOperationError) return error.code;
    throw error;
  }
}

export function useDeckActions() {
  const decks = () => runtime().repos.decks;
  return {
    create: (path: string) => attempt(() => decks().createByPath(path, SEED_IDS.preset)),
    rename: (id: string, name: string) => attempt(() => decks().rename(id, name)),
    move: (id: string, parentId: string | null) => attempt(() => decks().move(id, parentId)),
    remove: (id: string) => attempt(() => decks().deleteWithSubtree(id)),
    setCollapsed: (id: string, collapsed: boolean) =>
      attempt(() => decks().setCollapsed(id, collapsed)),
  };
}
