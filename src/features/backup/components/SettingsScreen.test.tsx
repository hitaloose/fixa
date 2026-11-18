import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeCard, makeDeck, makePreset } from "../../../../tests/factories";
import { renderWithRouter } from "../../../../tests/render";
import { setupRuntime } from "../../../../tests/runtime";
import { SettingsScreen, type SettingsScreenProps } from "./SettingsScreen";

const NOW = Date.parse("2026-11-16T15:00:00Z");
let rt: ReturnType<typeof setupRuntime>;

beforeEach(async () => {
  rt = setupRuntime({ now: NOW });
  const preset = makePreset();
  const deck = makeDeck({ presetId: preset.id, name: "Inglês" });
  await rt.db.presets.add(preset);
  await rt.db.decks.add(deck);
  await rt.db.cards.bulkAdd([makeCard({ deckId: deck.id }), makeCard({ deckId: deck.id })]);
});

function open(props: Partial<SettingsScreenProps> = {}) {
  const share = vi.fn(async () => "downloaded" as const);
  renderWithRouter(<SettingsScreen share={share} appVersion="0.1.0" {...props} />);
  return { share };
}

async function backupFile() {
  const { blob } = await rt.repos.backup.exportFile({ light: false, appVersion: "0.1.0" });
  return new File([blob], "fixa-backup.fixa", { type: "application/gzip" });
}

/** A folder the picker returns; a class so IndexedDB can store it (methods stay on the prototype). */
class FakeFolder {
  name = "Backups";
  written: string[] = [];
  async queryPermission() {
    return "granted" as PermissionState;
  }
  async requestPermission() {
    return "granted" as PermissionState;
  }
  async getFileHandle(name: string) {
    return {
      createWritable: async () => ({
        write: async () => {},
        close: async () => {
          this.written.push(name);
        },
      }),
    };
  }
}

describe("SettingsScreen", () => {
  it("exports a full backup and remembers when", async () => {
    const { share } = open();
    expect(await screen.findByText("Último backup: nunca")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Exportar backup" }));
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    const [blob, name] = share.mock.calls[0] as unknown as [Blob, string];
    expect(name).toMatch(/^fixa-backup-.*\.fixa$/);
    expect(blob.size).toBeGreaterThan(0);
    expect(await screen.findByText("Último backup: hoje")).toBeInTheDocument();
    expect(await rt.repos.settings.get("lastBackupAt")).toBe(NOW);
  });

  it("can export a light backup", async () => {
    const { share } = open();
    await userEvent.click(await screen.findByRole("radio", { name: /Leve/ }));
    await userEvent.click(screen.getByRole("button", { name: "Exportar backup" }));
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    const [blob] = share.mock.calls[0] as unknown as [Blob, string];
    expect((await rt.repos.backup.readFile(blob)).data.reviewLogs).toEqual([]);
  });

  it("merges a backup file", async () => {
    const file = await backupFile();
    await rt.db.cards.clear();
    open();
    await userEvent.upload(await screen.findByLabelText("Restaurar backup"), file);
    const dialog = await screen.findByRole("dialog", { name: "Restaurar backup" });
    expect(dialog).toHaveTextContent("2 cartões");
    await userEvent.click(within(dialog).getByRole("button", { name: "Mesclar" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Backup mesclado.");
    expect(await rt.db.cards.count()).toBe(2);
  });

  it("replaces everything only after typing the confirmation word", async () => {
    const file = await backupFile();
    await rt.db.decks.add(
      makeDeck({ presetId: (await rt.db.presets.toArray())[0]?.id ?? "", name: "Extra" }),
    );
    open();
    await userEvent.upload(await screen.findByLabelText("Restaurar backup"), file);
    const dialog = await screen.findByRole("dialog", { name: "Restaurar backup" });
    const replace = within(dialog).getByRole("button", { name: "Substituir tudo" });
    expect(replace).toBeDisabled();
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Digite “substituir” para confirmar" }),
      "substituir",
    );
    await userEvent.click(replace);
    expect(await screen.findByRole("status")).toHaveTextContent("Backup restaurado.");
    expect((await rt.db.decks.toArray()).map((d) => d.name)).toEqual(["Inglês"]);
  });

  it("lets any file be picked for restore (iOS greys out types it does not know, like .fixa)", async () => {
    open();
    expect(await screen.findByLabelText("Restaurar backup")).not.toHaveAttribute("accept");
  });

  it("explains when a file cannot be restored", async () => {
    open();
    await userEvent.upload(
      await screen.findByLabelText("Restaurar backup"),
      new File(["oops"], "x.fixa"),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esse arquivo não é um backup do Fixa.",
    );
  });

  it("changes study preferences", async () => {
    open();
    const cutoff = await screen.findByRole("spinbutton", { name: "Virada do dia (hora)" });
    expect(cutoff).toHaveValue(4);
    await userEvent.click(screen.getByRole("button", { name: "Aumentar Virada do dia (hora)" }));
    await waitFor(async () => expect(await rt.repos.settings.get("cutoffHour")).toBe(5));
    await userEvent.click(screen.getByRole("switch", { name: "Vibrar ao responder" }));
    await waitFor(async () => expect(await rt.repos.settings.get("haptics")).toBe(false));
  });

  it("chooses the theme: device, light or dark", async () => {
    open();
    const group = await screen.findByRole("radiogroup", { name: "Tema" });
    expect(within(group).getByRole("radio", { name: "Igual ao aparelho" })).toBeChecked();
    await userEvent.click(within(group).getByRole("radio", { name: "Escuro" }));
    await waitFor(async () => expect(await rt.repos.settings.get("theme")).toBe("dark"));
  });

  it("chooses the language and reloads to apply it", async () => {
    const reload = vi.fn();
    open({ reload });
    const group = await screen.findByRole("radiogroup", { name: "Idioma" });
    expect(within(group).getByRole("radio", { name: "Português (Brasil)" })).toBeChecked();
    await userEvent.click(within(group).getByRole("radio", { name: "English" }));
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(await rt.repos.settings.get("language")).toBe("en");
  });

  it("empties the trash after confirmation", async () => {
    const card = (await rt.db.cards.toArray())[0];
    await rt.db.cards.update(card?.id ?? "", { deletedAt: NOW, updatedAt: NOW });
    open();
    expect(await screen.findByText("1 item na lixeira")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Esvaziar lixeira" }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Esvaziar lixeira?" })).getByRole("button", {
        name: "Esvaziar",
      }),
    );
    expect(await screen.findByText("Lixeira vazia")).toBeInTheDocument();
    expect(await rt.db.cards.count()).toBe(1);
  });

  it("links to importing from Anki", async () => {
    open();
    expect(await screen.findByRole("link", { name: "Importar do Anki" })).toHaveAttribute(
      "href",
      "/import",
    );
  });

  it("exports everything as an Anki package", async () => {
    const writeAnkiPackage = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const { share } = open({ writeAnkiPackage });
    await userEvent.click(
      await screen.findByRole("button", { name: "Exportar para o Anki (.apkg)" }),
    );
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    const [data] = writeAnkiPackage.mock.calls[0] as unknown as [
      { rows: { col: { decks: string } } },
    ];
    const decks = Object.values(JSON.parse(data.rows.col.decks)) as Array<{ name: string }>;
    expect(decks.map((d) => d.name).sort()).toEqual(["Default", "Inglês"]);
    const [blob, name] = share.mock.calls[0] as unknown as [Blob, string];
    expect(name).toBe("fixa.apkg");
    expect(blob.size).toBe(3);
  });

  it("explains where automatic backup to a folder works", async () => {
    open();
    expect(
      await screen.findByText("O backup automático em pasta funciona no Chrome e no Edge."),
    ).toBeInTheDocument();
  });

  it("backs up into a chosen folder, now and after study sessions, until turned off", async () => {
    const folder = new FakeFolder();
    open({ pickFolder: async () => folder as never, folderPickerSupported: true });
    await userEvent.click(await screen.findByRole("button", { name: "Escolher pasta" }));
    expect(await screen.findByText("Pasta: Backups")).toBeInTheDocument();
    await waitFor(() => expect(folder.written).toEqual(["fixa-backup-automatico.fixa"]));
    expect(await rt.repos.autoBackup.folder()).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Fazer backup agora" }));
    await waitFor(() => expect(folder.written).toHaveLength(2));
    await userEvent.click(screen.getByRole("button", { name: "Desativar" }));
    expect(await screen.findByRole("button", { name: "Escolher pasta" })).toBeInTheDocument();
    expect(await rt.repos.autoBackup.folder()).toBeNull();
  });

  it("tells when storage information is unavailable", async () => {
    open();
    expect(
      await screen.findByText("Informação de armazenamento indisponível neste navegador."),
    ).toBeInTheDocument();
  });
});
