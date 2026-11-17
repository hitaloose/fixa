/// <reference lib="webworker" />
/**
 * Anki packages off the main thread (docs/08-import-export.md): reading (unzip + sql.js) and
 * writing legacy .apkg files. Mapping and database access happen on the main thread.
 */
import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { readApkg } from "../lib/anki/apkg";
import { type ApkgRows, writeApkg } from "../lib/anki/writeApkg";

export type WorkerRequest =
  | { type: "read"; buffer: ArrayBuffer }
  | { type: "write"; rows: ApkgRows; media: Array<{ name: string; bytes: Uint8Array }> };

const scope = self as unknown as DedicatedWorkerGlobalScope;
const sqlReady = initSqlJs({ locateFile: () => wasmUrl });

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    const SQL = await sqlReady;
    const request = event.data;
    const result =
      request.type === "read"
        ? readApkg(new Uint8Array(request.buffer), SQL)
        : writeApkg(request.rows, request.media, SQL);
    scope.postMessage({ ok: true, result });
  } catch (error) {
    scope.postMessage({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
