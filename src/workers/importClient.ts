import type { ApkgContents } from "../lib/anki/apkg";

type Reply = { ok: true; result: ApkgContents } | { ok: false; message: string };

/** Reads an Anki package in a Web Worker; one worker per call, closed when done. */
export async function readAnkiPackage(file: Blob): Promise<ApkgContents> {
  const buffer = await file.arrayBuffer();
  const worker = new Worker(new URL("./import.worker.ts", import.meta.url), { type: "module" });
  try {
    const reply = await new Promise<Reply>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<Reply>) => resolve(event.data);
      worker.onerror = (event) => reject(new Error(event.message));
      worker.postMessage(buffer, [buffer]);
    });
    if (!reply.ok) throw new Error(reply.message);
    return reply.result;
  } finally {
    worker.terminate();
  }
}
