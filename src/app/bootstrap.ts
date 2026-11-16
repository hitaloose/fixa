import { createDb } from "../data/db";
import { configureRuntime } from "../data/runtime";
import { ensureSeed } from "../data/seed";
import { t } from "../i18n/pt-BR";
import { systemClock } from "../lib/clock";
import { uuidv7Generator } from "../lib/ids";
import { requestPersistentStorage } from "../lib/storage";

/** Wires data, seeds defaults on first use and asks for persistent storage. */
export async function bootstrap(): Promise<void> {
  const db = createDb("fixa");
  configureRuntime({ db, clock: systemClock, ids: uuidv7Generator });
  await ensureSeed({ db, clock: systemClock }, t.seed);
  // Fire and forget: never block the first render on a permission prompt.
  void requestPersistentStorage(navigator);
}
