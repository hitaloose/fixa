/**
 * Public API of the domain model: plain TS types + parse functions.
 * zod is an implementation detail and never leaves this module (docs/02-stack.md › Decisões).
 */
export type { BaseEntity } from "./base";
export { type Card, type FsrsState, parseCard, type Queue } from "./card";
export { type Deck, type DeckOverrides, parseDeck } from "./deck";
export { type Media, parseMedia } from "./media";
export { type Note, parseNote } from "./note";
export { type CardTemplate, type NoteField, type NoteType, parseNoteType } from "./noteType";
export { type Preset, type PresetInput, parsePreset } from "./preset";
export { type CardSnapshot, parseReviewLog, type ReviewLog } from "./reviewLog";
export {
  DEFAULT_SETTINGS,
  parseSetting,
  type SettingKey,
  type Settings,
  safeParseSetting,
} from "./settings";
