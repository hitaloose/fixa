import type { AnkiPackageData } from "../../../data/repositories";
import { runtime } from "../../../data/runtime";
import type { ShareOutcome } from "../../../lib/share";

export type WriteAnkiPackage = (
  data: Pick<AnkiPackageData, "rows" | "media">,
) => Promise<Uint8Array>;

/** Builds the .apkg (one deck with subdecks, or everything) and hands it to the user. */
export function useAnkiExport(
  write: WriteAnkiPackage,
  share: (blob: Blob, fileName: string) => Promise<ShareOutcome>,
) {
  return async (deckId?: string): Promise<ShareOutcome> => {
    const data = await runtime().repos.ankiExport.buildPackage(deckId);
    const bytes = await write({ rows: data.rows, media: data.media });
    return share(
      new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }),
      data.fileName,
    );
  };
}
