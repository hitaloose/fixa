import { Link } from "@tanstack/react-router";
import { type ChangeEvent, useId, useState } from "react";
import { type DelimitedFile, parseDelimited } from "../../../domain/import/csv";
import { t } from "../../../i18n";
import type { ApkgContents } from "../../../lib/anki/apkg";
import { useAnkiImport } from "../hooks/useAnkiImport";
import { CsvImport } from "./CsvImport";

const m = t.importer;

type Status =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "mapping"; file: DelimitedFile }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

export interface ImportScreenProps {
  /** Reads the package (in a Web Worker in the app). */
  readPackage: (file: Blob) => Promise<ApkgContents>;
}

export function ImportScreen({ readPackage }: ImportScreenProps) {
  const importCollection = useAnkiImport();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const inputId = useId();

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (/\.(csv|txt|tsv)$/i.test(file.name)) {
      setStatus({ kind: "mapping", file: parseDelimited(await file.text()) });
      return;
    }
    setStatus({ kind: "reading" });
    try {
      const contents = await readPackage(file);
      if (contents.format === "unsupported")
        return setStatus({ kind: "error", message: m.errors.unsupported });
      if (contents.format === "unknown")
        return setStatus({ kind: "error", message: m.errors.unknown });
      const summary = await importCollection(contents.collection, contents.media);
      setStatus({ kind: "done", message: m.done(summary) });
    } catch {
      setStatus({ kind: "error", message: m.errors.unreadable });
    }
  };

  return (
    <div className="flex flex-col gap-4 pt-4 pb-6">
      <h1 className="font-display text-[28px] font-bold">{m.title}</h1>
      <p className="max-w-prose text-muted">{m.intro}</p>
      <label
        htmlFor={inputId}
        className="inline-flex min-h-14 cursor-pointer items-center justify-center rounded-list bg-contrast px-4 font-semibold text-on-contrast focus-within:outline-2"
      >
        {m.pick}
      </label>
      <input
        id={inputId}
        type="file"
        // No `accept`: iOS greys out .apkg/.colpkg (unknown types); content is checked on read.
        className="sr-only"
        disabled={status.kind === "reading"}
        onChange={(e) => void pick(e)}
      />
      {status.kind === "reading" ? <p className="text-muted">{m.reading}</p> : null}
      {status.kind === "mapping" ? (
        <CsvImport file={status.file} onDone={(message) => setStatus({ kind: "done", message })} />
      ) : null}
      {status.kind === "done" ? (
        <div className="flex flex-col gap-2 rounded-section border border-line bg-surface p-4">
          <p role="status">{status.message}</p>
          <Link to="/" className="inline-flex min-h-11 items-center font-semibold text-primary">
            {m.seeDecks}
          </Link>
        </div>
      ) : null}
      {status.kind === "error" ? (
        <p role="alert" className="text-danger">
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
