import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "../../../../tests/render";
import { setupRuntime } from "../../../../tests/runtime";
import { ensureSeed, SEED_IDS } from "../../../data/seed";
import { t } from "../../../i18n/pt-BR";
import type { ApkgContents } from "../../../lib/anki/apkg";
import { ImportScreen } from "./ImportScreen";

const CRT = 1_700_000_000;
const collection = {
  col: {
    crt: CRT,
    models: JSON.stringify({
      1: {
        id: 1,
        name: "Basic",
        type: 0,
        css: "",
        flds: [
          { name: "Front", ord: 0 },
          { name: "Back", ord: 1 },
        ],
        tmpls: [{ name: "Card 1", ord: 0, qfmt: "{{Front}}", afmt: "{{Back}}" }],
      },
    }),
    decks: JSON.stringify({ 10: { id: 10, name: "Francês", conf: 1 } }),
    dconf: JSON.stringify({
      1: {
        id: 1,
        name: "Default",
        new: { perDay: 20, delays: [1, 10] },
        rev: { perDay: 200, maxIvl: 36500 },
        lapse: { delays: [10], leechFails: 8, leechAction: 1 },
      },
    }),
  },
  notes: [{ id: 1_700_000_000_001, guid: "g1", mid: 1, mod: CRT, tags: "", flds: "chat\x1fgato" }],
  cards: [
    {
      id: 1_700_000_000_002,
      nid: 1_700_000_000_001,
      did: 10,
      ord: 0,
      mod: CRT,
      type: 0,
      queue: 0,
      due: 1,
      ivl: 0,
      factor: 0,
      reps: 0,
      lapses: 0,
      left: 0,
      odid: 0,
      flags: 0,
      data: "",
    },
  ],
  revlog: [],
};

let rt: ReturnType<typeof setupRuntime>;
beforeEach(async () => {
  rt = setupRuntime();
  await ensureSeed(rt, t.seed);
});

function open(result: ApkgContents | Error) {
  const readPackage = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  renderWithRouter(<ImportScreen readPackage={readPackage} />);
  return readPackage;
}

const pick = async (name = "deck.apkg") =>
  userEvent.upload(await screen.findByLabelText("Escolher arquivo"), new File(["zip"], name));

describe("ImportScreen", () => {
  it("imports an Anki package and summarises what came in", async () => {
    const readPackage = open({ format: "anki", collection, media: [] } as ApkgContents);
    await pick();
    expect(readPackage).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Importado: 1 baralho, 1 nota, 1 cartão.",
    );
    expect(screen.getByRole("link", { name: "Ver baralhos" })).toHaveAttribute("href", "/");
    expect((await rt.db.decks.toArray()).map((d) => d.name)).toEqual(["Francês"]);
  });

  it("says how many notes were already there on a re-import", async () => {
    open({ format: "anki", collection, media: [] } as ApkgContents);
    await pick();
    await screen.findByRole("status");
    await pick();
    expect(
      await screen.findByText("Importado: 0 baralhos, 0 notas, 0 cartões. 1 nota já existia."),
    ).toBeInTheDocument();
  });

  it("asks to re-export packages from a newer, unknown package version", async () => {
    open({ format: "unsupported" });
    await pick();
    expect(await screen.findByRole("alert")).toHaveTextContent("Suportar versões antigas do Anki");
  });

  it("explains files that are not Anki packages", async () => {
    open({ format: "unknown" });
    await pick("renomeado.apkg");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esse arquivo não é um pacote do Anki (.apkg).",
    );
  });

  it("explains a package that cannot be read", async () => {
    open(new Error("boom"));
    await pick();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível ler esse arquivo.",
    );
  });

  describe("CSV / TXT", () => {
    const csv = (text: string, name = "palavras.csv") =>
      userEvent.upload(
        screen.getByLabelText("Escolher arquivo"),
        new File([text], name, { type: "text/csv" }),
      );

    beforeEach(async () => {
      await rt.repos.decks.createByPath("Inglês", SEED_IDS.preset);
    });

    it("maps columns to fields, previews and imports the rows", async () => {
      open({ format: "unknown" });
      await screen.findByLabelText("Escolher arquivo");
      await csv("cat;gato;animais\ndog;cão;animais\n");
      const preview = await screen.findByRole("table", { name: "Pré-visualização" });
      expect(within(preview).getAllByRole("row")).toHaveLength(3);
      expect(screen.getByRole("combobox", { name: "Coluna 1" })).toHaveDisplayValue("Frente");
      expect(screen.getByRole("combobox", { name: "Coluna 2" })).toHaveDisplayValue("Verso");
      await userEvent.selectOptions(
        screen.getByRole("combobox", { name: "Coluna 3" }),
        "Etiquetas",
      );
      await userEvent.click(screen.getByRole("button", { name: "Importar 2 linhas" }));
      expect(await screen.findByRole("status")).toHaveTextContent("Importado: 2 notas.");
      const notes = await rt.db.notes.toArray();
      expect(notes.map((n) => [n.fields.front, n.fields.back, n.tags]).sort()).toEqual([
        ["cat", "gato", ["animais"]],
        ["dog", "cão", ["animais"]],
      ]);
    });

    it("uses the first row as header when asked, and the file's # directives", async () => {
      open({ format: "unknown" });
      await screen.findByLabelText("Escolher arquivo");
      await csv(
        "#separator:Tab\n#html:true\n#tags:vocab\nVerso\tFrente\n<b>gato</b>\tcat\n",
        "x.txt",
      );
      await screen.findByRole("table", { name: "Pré-visualização" });
      await userEvent.click(screen.getByRole("switch", { name: "Primeira linha é cabeçalho" }));
      expect(screen.getByRole("combobox", { name: "Verso" })).toHaveDisplayValue("Verso");
      expect(screen.getByRole("combobox", { name: "Frente" })).toHaveDisplayValue("Frente");
      await userEvent.click(screen.getByRole("button", { name: "Importar 1 linha" }));
      await screen.findByRole("status");
      expect((await rt.db.notes.toArray())[0]).toMatchObject({
        fields: { front: "cat", back: "<b>gato</b>" },
        tags: ["vocab"],
      });
    });

    it("reports duplicates and rows without cards", async () => {
      const deck = (await rt.db.decks.toArray())[0];
      await rt.repos.notes.add({
        noteTypeId: SEED_IDS.basic,
        deckId: deck?.id ?? "",
        fields: { front: "cat", back: "" },
        tags: [],
      });
      open({ format: "unknown" });
      await screen.findByLabelText("Escolher arquivo");
      await csv("cat;gato\n;vazio\nbird;pássaro\n");
      await userEvent.click(await screen.findByRole("button", { name: "Importar 3 linhas" }));
      expect(await screen.findByRole("status")).toHaveTextContent(
        "Importado: 1 nota. 1 já existia e foi mantida. 1 linha sem cartão foi ignorada.",
      );
    });
  });
});
