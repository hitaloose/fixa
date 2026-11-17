/// <reference lib="webworker" />
/**
 * Reads Anki packages off the main thread (docs/08-import-export.md): unzip + sql.js.
 * Mapping and writing happen on the main thread (data/ankiImport).
 */
import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { readApkg } from "../lib/anki/apkg";

const scope = self as unknown as DedicatedWorkerGlobalScope;
const sqlReady = initSqlJs({ locateFile: () => wasmUrl });

scope.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const result = readApkg(new Uint8Array(event.data), await sqlReady);
    scope.postMessage({ ok: true, result });
  } catch (error) {
    scope.postMessage({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
