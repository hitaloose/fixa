import type { ApkgContents } from "../lib/anki/apkg";
import type { ApkgRows } from "../lib/anki/writeApkg";
import type { WorkerRequest } from "./import.worker";

type Reply<T> = { ok: true; result: T } | { ok: false; message: string };

/** One worker per call, closed when done. */
async function run<T>(request: WorkerRequest, transfer: Transferable[] = []): Promise<T> {
  const worker = new Worker(new URL("./import.worker.ts", import.meta.url), { type: "module" });
  try {
    const reply = await new Promise<Reply<T>>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<Reply<T>>) => resolve(event.data);
      worker.onerror = (event) => reject(new Error(event.message));
      worker.postMessage(request, transfer);
    });
    if (!reply.ok) throw new Error(reply.message);
    return reply.result;
  } finally {
    worker.terminate();
  }
}

/** Reads an Anki package in a Web Worker. */
export async function readAnkiPackage(file: Blob): Promise<ApkgContents> {
  const buffer = await file.arrayBuffer();
  return run<ApkgContents>({ type: "read", buffer }, [buffer]);
}

/** Writes a legacy .apkg in a Web Worker. */
export function writeAnkiPackage(data: {
  rows: ApkgRows;
  media: Array<{ name: string; bytes: Uint8Array }>;
}): Promise<Uint8Array> {
  return run<Uint8Array>({ type: "write", rows: data.rows, media: data.media });
}
