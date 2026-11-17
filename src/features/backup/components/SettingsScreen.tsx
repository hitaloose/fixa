import { Link } from "@tanstack/react-router";
import { type ChangeEvent, type ReactNode, useId, useState } from "react";
import { BackupFileError } from "../../../data/repositories";
import type { Backup } from "../../../domain/backup";
import { t } from "../../../i18n/pt-BR";
import { type ShareOutcome, shareOrDownload } from "../../../lib/share";
import { Button, Sheet, Stepper, Switch, TextField, Toast } from "../../../ui";
import { useAnkiExport, type WriteAnkiPackage } from "../hooks/useAnkiExport";
import { useBackupActions, useSettingsData, useStorageInfo } from "../hooks/useBackup";

const s = t.settings;

export interface SettingsScreenProps {
  /** Hands the backup file to the user (share sheet or download). */
  share?: (blob: Blob, fileName: string) => Promise<ShareOutcome>;
  appVersion?: string;
  /** Writes an .apkg (a Web Worker in the app); the export button shows only when given. */
  writeAnkiPackage?: WriteAnkiPackage;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-section border border-line bg-surface p-4">
      <h2 id={id} className="mb-2 text-sm font-semibold text-muted">
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

const mb = (bytes: number) => (bytes / 1_000_000).toFixed(1).replace(".", ",");

function RestoreSheet({
  backup,
  onClose,
  onMerge,
  onReplace,
}: {
  backup: Backup;
  onClose: () => void;
  onMerge: () => void;
  onReplace: () => void;
}) {
  const [word, setWord] = useState("");
  const activeDecks = backup.data.decks.filter((d) => d.deletedAt === null).length;
  const activeCards = backup.data.cards.filter((c) => c.deletedAt === null).length;
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(backup.exportedAt);
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={s.restoreTitle}
      closeLabel={t.common.close}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm">{s.restoreSummary(activeDecks, activeCards, date)}</p>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">{s.mergeExplain}</p>
          <Button onClick={onMerge}>{s.merge}</Button>
        </div>
        <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
          <p className="text-sm text-muted">{s.replaceExplain}</p>
          <TextField
            label={s.replaceConfirm}
            value={word}
            onChange={setWord}
            autoCapitalize="none"
          />
          <Button
            variant="danger"
            disabled={word.trim().toLowerCase() !== s.replaceWord}
            onClick={onReplace}
          >
            {s.replace}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

export function SettingsScreen({
  share = shareOrDownload,
  appVersion = "0.0.0",
  writeAnkiPackage,
}: SettingsScreenProps) {
  const exportAnki = useAnkiExport(writeAnkiPackage ?? (async () => new Uint8Array()), share);
  const data = useSettingsData();
  const storage = useStorageInfo();
  const actions = useBackupActions();
  const [light, setLight] = useState(false);
  const [pending, setPending] = useState<Backup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const fileId = useId();
  const kindName = useId();

  if (!data) return null;

  const exportBackup = async () => {
    const { blob, fileName } = await actions.exportFile(light, appVersion);
    const outcome = await share(blob, fileName);
    if (outcome !== "cancelled") setToast(s.exported);
  };

  const pickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      setPending(await actions.readFile(file));
    } catch (err) {
      if (err instanceof BackupFileError) setError(s.errors[err.code]);
      else throw err;
    }
  };

  const restore = async (mode: "merge" | "replace") => {
    if (!pending) return;
    const backup = pending;
    setPending(null);
    if (mode === "merge") await actions.merge(backup);
    else await actions.replaceAll(backup);
    setToast(mode === "merge" ? s.merged : s.replaced);
  };

  return (
    <div className="flex flex-col gap-4 pt-4 pb-6">
      <h1 className="font-display text-[28px] font-bold">{s.title}</h1>

      <Section title={s.backup}>
        <p className="text-sm text-muted">{s.lastBackup(data.daysSinceBackup)}</p>
        <div role="radiogroup" aria-label={s.kind} className="flex flex-col gap-1">
          {([false, true] as const).map((isLight) => (
            <label key={String(isLight)} className="flex min-h-11 items-center gap-3">
              <input
                type="radio"
                name={kindName}
                checked={light === isLight}
                onChange={() => setLight(isLight)}
                className="size-5 accent-primary"
              />
              {isLight ? s.light : s.full}
            </label>
          ))}
        </div>
        <Button onClick={() => void exportBackup()}>{s.export}</Button>
        <label
          htmlFor={fileId}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-button border border-line px-4 font-semibold focus-within:outline-2"
        >
          {s.restore}
        </label>
        <input
          id={fileId}
          type="file"
          accept=".fixa,application/gzip"
          className="sr-only"
          onChange={(e) => void pickFile(e)}
        />
        <p className="text-xs text-muted">{s.restoreHint}</p>
        {writeAnkiPackage ? (
          <Button
            variant="secondary"
            onClick={() =>
              void exportAnki().then(
                (outcome) => outcome !== "cancelled" && setToast(s.exportedAnki),
              )
            }
          >
            {s.exportAnki}
          </Button>
        ) : null}
        <Link
          to="/import"
          className="inline-flex min-h-11 items-center justify-center rounded-button border border-line px-4 font-semibold"
        >
          {t.importer.open}
        </Link>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </Section>

      <Section title={s.study}>
        <Stepper
          label={s.cutoffHour}
          hint={s.cutoffHint}
          value={data.cutoffHour}
          min={0}
          max={23}
          onChange={(v) => void actions.setSetting("cutoffHour", v)}
        />
        <Switch
          label={s.haptics}
          checked={data.haptics}
          onChange={(v) => void actions.setSetting("haptics", v)}
        />
        <Stepper
          label={s.reminderDays}
          value={data.backupReminderDays}
          min={1}
          max={90}
          onChange={(v) => void actions.setSetting("backupReminderDays", v)}
        />
      </Section>

      <Section title={s.storage}>
        {storage.info === undefined ? null : storage.info === null ? (
          <p className="text-sm text-muted">{s.noStorageInfo}</p>
        ) : (
          <>
            <p className="text-sm">{s.persisted(storage.info.persisted)}</p>
            <p className="text-sm text-muted">
              {s.usage(mb(storage.info.usage), mb(storage.info.quota))}
            </p>
            {storage.info.persisted ? null : (
              <Button variant="secondary" onClick={() => void storage.askPersist()}>
                {s.askPersist}
              </Button>
            )}
          </>
        )}
        <p className="text-xs text-muted">{s.iosHint}</p>
      </Section>

      <Section title={s.trash}>
        <p className="text-sm">{s.trashCount(data.trashCount)}</p>
        {data.trashCount > 0 ? (
          <Button variant="secondary" onClick={() => setConfirmTrash(true)}>
            {s.emptyTrash}
          </Button>
        ) : null}
      </Section>

      {pending ? (
        <RestoreSheet
          backup={pending}
          onClose={() => setPending(null)}
          onMerge={() => void restore("merge")}
          onReplace={() => void restore("replace")}
        />
      ) : null}
      {confirmTrash ? (
        <Sheet
          open
          onOpenChange={(o) => !o && setConfirmTrash(false)}
          title={s.emptyTrashTitle}
          description={s.emptyTrashDescription}
          closeLabel={t.common.close}
        >
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmTrash(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                setConfirmTrash(false);
                void actions.emptyTrash().then(() => setToast(s.emptied));
              }}
            >
              {s.emptyTrashConfirm}
            </Button>
          </div>
        </Sheet>
      ) : null}
      {toast ? <Toast message={toast} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
