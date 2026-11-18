import { createDb } from "../data/db";
import { runStartupMaintenance } from "../data/maintenance";
import { configureRuntime, runtime } from "../data/runtime";
import { ensureSeed } from "../data/seed";
import { setLocale, t } from "../i18n";
import { systemClock } from "../lib/clock";
import { uuidv7Generator } from "../lib/ids";
import { requestPersistentStorage } from "../lib/storage";
import { deviceTimeZone } from "../lib/timeZone";

/**
 * Wires data, applies the chosen language, seeds defaults on first use and asks
 * for persistent storage. Must finish before the routes load (they read `t`).
 */
export async function bootstrap(): Promise<void> {
  const db = createDb("fixa");
  configureRuntime({ db, clock: systemClock, ids: uuidv7Generator, timeZone: deviceTimeZone() });
  const language = await runtime().repos.settings.get("language");
  setLocale(language);
  document.documentElement.lang = language;
  await ensureSeed({ db, clock: systemClock }, t.seed);
  // Fire and forget: housekeeping and the permission prompt never block the first render.
  void runStartupMaintenance(runtime().repos);
  void requestPersistentStorage(navigator);
}
