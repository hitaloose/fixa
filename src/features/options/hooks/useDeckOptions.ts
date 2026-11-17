import { useLiveQuery } from "dexie-react-hooks";
import type { DeckOptionsWrite } from "../../../data/repositories";
import { runtime } from "../../../data/runtime";
import { SEED_IDS } from "../../../data/seed";
import { studyDay } from "../../../domain/day";
import { deckPath } from "../../../domain/decks";
import type { Deck, Preset, PresetValues } from "../../../domain/model";

export interface DeckOptionsData {
  deck: Deck;
  path: string;
  /** Default preset first, then by name. */
  presets: Preset[];
  usage: Record<string, number>;
  today: string;
}

const byDefaultThenName = (a: Preset, b: Preset) =>
  Number(b.id === SEED_IDS.preset) - Number(a.id === SEED_IDS.preset) ||
  a.name.localeCompare(b.name, "pt-BR");

/** undefined while loading; null when the deck does not exist. */
export function useDeckOptions(deckId: string): DeckOptionsData | null | undefined {
  return useLiveQuery(async () => {
    const { repos, clock, timeZone } = runtime();
    const [decks, presets, usage, cutoffHour] = await Promise.all([
      repos.decks.listActive(),
      repos.presets.listActive(),
      repos.presets.usage(),
      repos.settings.get("cutoffHour"),
    ]);
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return null;
    return {
      deck,
      path: deckPath(deck.id, decks),
      presets: [...presets].sort(byDefaultThenName),
      usage,
      today: studyDay(clock.now(), cutoffHour, timeZone),
    };
  }, [deckId]);
}

export const DEFAULT_PRESET_ID = SEED_IDS.preset;

export function useOptionsActions() {
  const repos = () => runtime().repos;
  return {
    save: (write: DeckOptionsWrite) => repos().decks.applyOptions(write),
    async clone(deckId: string, name: string, values: PresetValues) {
      const preset = await repos().presets.clone(name, values);
      await repos().decks.update(deckId, { presetId: preset.id });
    },
    rename: (presetId: string, name: string) => repos().presets.update(presetId, { name }),
    remove: (presetId: string) => repos().presets.remove(presetId, DEFAULT_PRESET_ID),
    restore: (presetId: string) => repos().presets.restoreDefaults(presetId),
  };
}
