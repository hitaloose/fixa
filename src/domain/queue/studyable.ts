import type { Card } from "../model";

/** A card a study session may show: not deleted, suspended or buried. */
export const studyable = (c: Card | undefined): c is Card =>
  c !== undefined && c.deletedAt === null && c.queue !== "suspended" && c.queue !== "buried";
