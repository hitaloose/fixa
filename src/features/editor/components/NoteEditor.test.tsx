import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "../../../../tests/render";
import { setupRuntime } from "../../../../tests/runtime";
import { ensureSeed, SEED_IDS } from "../../../data/seed";
import { t } from "../../../i18n/pt-BR";
import { AddNoteScreen, EditNoteScreen } from "./NoteEditor";

let rt: ReturnType<typeof setupRuntime>;

beforeEach(async () => {
  rt = setupRuntime();
  await ensureSeed(rt, t.seed);
});

const field = (name: string) => screen.findByRole("textbox", { name });

async function fill(name: string, text: string) {
  await userEvent.click(await field(name));
  await userEvent.paste(text);
}

const addButton = () => screen.getByRole("button", { name: "Adicionar" });

describe("AddNoteScreen", () => {
  it("adds a basic note to the chosen deck and clears the fields", async () => {
    const deck = await rt.repos.decks.createByPath("Inglês", SEED_IDS.preset);
    renderWithRouter(<AddNoteScreen deckId={deck.id} />);
    await fill("Frente", "cat");
    await fill("Verso", "gato");
    await userEvent.click(addButton());
    expect(await screen.findByRole("status")).toHaveTextContent("Nota adicionada.");
    const notes = await rt.db.notes.toArray();
    expect(notes.map((n) => n.fields)).toEqual([{ front: "cat", back: "gato" }]);
    const cards = await rt.db.cards.toArray();
    expect(cards.map((c) => c.deckId)).toEqual([deck.id]);
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Frente" })).toHaveTextContent(/^$/),
    );
  });

  it("uses the first deck when none is given, and lets the user pick another", async () => {
    await rt.repos.decks.createByPath("Matemática", SEED_IDS.preset);
    const ingles = await rt.repos.decks.createByPath("Inglês::Idioms", SEED_IDS.preset);
    renderWithRouter(<AddNoteScreen />);
    const deckSelect = await screen.findByRole("combobox", { name: "Baralho" });
    expect(
      within(deckSelect)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Inglês", "Inglês::Idioms", "Matemática"]);
    expect(deckSelect).toHaveDisplayValue("Inglês");
    await userEvent.selectOptions(deckSelect, "Inglês::Idioms");
    await fill("Frente", "break a leg");
    await userEvent.click(addButton());
    await screen.findByRole("status");
    expect((await rt.db.cards.toArray()).map((c) => c.deckId)).toEqual([ingles.id]);
  });

  it("saves tags typed by the user, normalised", async () => {
    await rt.repos.decks.createByPath("Inglês", SEED_IDS.preset);
    renderWithRouter(<AddNoteScreen />);
    await fill("Frente", "cat");
    await userEvent.type(screen.getByRole("textbox", { name: "Etiquetas" }), "Animais  verbos");
    await userEvent.click(addButton());
    await screen.findByRole("status");
    expect((await rt.db.notes.toArray())[0]?.tags).toEqual(["animais", "verbos"]);
    expect(screen.getByRole("textbox", { name: "Etiquetas" })).toHaveValue("Animais  verbos");
  });

  it("keeps pinned fields after adding", async () => {
    await rt.repos.decks.createByPath("Inglês", SEED_IDS.preset);
    renderWithRouter(<AddNoteScreen />);
    await fill("Frente", "cat");
    await fill("Verso", "gato");
    const pin = screen.getByRole("button", { name: "Fixar Frente" });
    expect(pin).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(pin);
    await waitFor(() => expect(pin).toHaveAttribute("aria-pressed", "true"));
    await userEvent.click(addButton());
    await screen.findByRole("status");
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Verso" })).toHaveTextContent(/^$/),
    );
    expect(screen.getByRole("textbox", { name: "Frente" })).toHaveTextContent("cat");
    const basic = await rt.db.noteTypes.get(SEED_IDS.basic);
    expect(basic?.fields.map((f) => f.sticky)).toEqual([true, false]);
  });

  it("explains why an empty note cannot be added", async () => {
    await rt.repos.decks.createByPath("Inglês", SEED_IDS.preset);
    renderWithRouter(<AddNoteScreen />);
    await field("Frente");
    await userEvent.click(addButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("Preencha a frente do cartão.");
    expect(await rt.db.notes.count()).toBe(0);
  });

  it("switches to the cloze note type, with its cloze button and message", async () => {
    await rt.repos.decks.createByPath("Inglês", SEED_IDS.preset);
    renderWithRouter(<AddNoteScreen />);
    await userEvent.selectOptions(
      await screen.findByRole("combobox", { name: "Tipo de nota" }),
      "Omissão",
    );
    await fill("Texto", "Brasília");
    expect(screen.queryByRole("textbox", { name: "Frente" })).not.toBeInTheDocument();
    await userEvent.click(addButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Adicione ao menos uma omissão, como {{c1::texto}}.",
    );
    expect(screen.getAllByRole("button", { name: "Omissão" }).length).toBeGreaterThan(0);
  });

  it("keeps field contents by position when the note type changes", async () => {
    await rt.repos.decks.createByPath("Inglês", SEED_IDS.preset);
    renderWithRouter(<AddNoteScreen />);
    await fill("Frente", "cat");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Tipo de nota" }),
      "Omissão",
    );
    expect(await field("Texto")).toHaveTextContent("cat");
  });

  it("warns when a note with the same first field exists", async () => {
    const deck = await rt.repos.decks.createByPath("Inglês", SEED_IDS.preset);
    await rt.repos.notes.add({
      noteTypeId: SEED_IDS.basic,
      deckId: deck.id,
      fields: { front: "<b>cat</b>", back: "" },
      tags: [],
    });
    renderWithRouter(<AddNoteScreen />);
    await fill("Frente", "cat");
    expect(await screen.findByText("Já existe uma nota com esse conteúdo.")).toBeInTheDocument();
  });

  it("previews the cards the note would create", async () => {
    await rt.repos.decks.createByPath("Inglês", SEED_IDS.preset);
    renderWithRouter(<AddNoteScreen />);
    await userEvent.selectOptions(
      await screen.findByRole("combobox", { name: "Tipo de nota" }),
      "Básico (e invertido)",
    );
    await fill("Frente", "cat");
    await fill("Verso", "gato");
    await userEvent.click(screen.getByRole("button", { name: "Pré-visualizar" }));
    const dialog = screen.getByRole("dialog", { name: "Pré-visualização" });
    const cards = within(dialog).getAllByRole("article");
    expect(cards.map((c) => within(c).getByRole("heading").textContent)).toEqual([
      "Cartão 1",
      "Cartão 2",
    ]);
    expect(cards[1]).toHaveTextContent(/gato.*cat/);
  });

  it("lists recently added notes, linking to their editor", async () => {
    const deck = await rt.repos.decks.createByPath("Inglês", SEED_IDS.preset);
    const { note } = await rt.repos.notes.add({
      noteTypeId: SEED_IDS.basic,
      deckId: deck.id,
      fields: { front: "cat", back: "" },
      tags: [],
    });
    renderWithRouter(<AddNoteScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Histórico" }));
    const dialog = screen.getByRole("dialog", { name: "Adicionadas recentemente" });
    expect(await within(dialog).findByRole("link", { name: "cat" })).toHaveAttribute(
      "href",
      `/notes/${note.id}/edit`,
    );
  });

  it("asks for a deck first when there is none", async () => {
    renderWithRouter(<AddNoteScreen />);
    expect(
      await screen.findByText("Crie um baralho antes de adicionar cartões."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para baralhos" })).toHaveAttribute("href", "/");
  });
});

describe("EditNoteScreen", () => {
  async function existing() {
    const deck = await rt.repos.decks.createByPath("Inglês", SEED_IDS.preset);
    return (
      await rt.repos.notes.add({
        noteTypeId: SEED_IDS.basic,
        deckId: deck.id,
        fields: { front: "cat", back: "gato" },
        tags: ["animais"],
      })
    ).note;
  }

  it("loads the note and saves changes", async () => {
    const note = await existing();
    const onSaved = vi.fn();
    renderWithRouter(<EditNoteScreen noteId={note.id} onSaved={onSaved} />);
    expect(await screen.findByRole("heading", { name: "Editar nota" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Verso" })).toHaveTextContent("gato"),
    );
    expect(screen.getByRole("textbox", { name: "Etiquetas" })).toHaveValue("animais");
    expect(screen.queryByRole("combobox", { name: "Baralho" })).not.toBeInTheDocument();
    // jsdom has no layout, so the caret lands at the start: replace the whole content.
    await userEvent.click(await field("Verso"));
    await userEvent.keyboard("{Control>}a{/Control}");
    await userEvent.paste("cão");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect((await rt.db.notes.get(note.id))?.fields.back).toBe("cão");
  });

  it("does not warn that the note duplicates itself", async () => {
    const note = await existing();
    renderWithRouter(<EditNoteScreen noteId={note.id} onSaved={() => {}} />);
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Frente" })).toHaveTextContent("cat"),
    );
    await fill("Verso", "!");
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Já existe uma nota com esse conteúdo.")).not.toBeInTheDocument();
  });

  it("tells when the note does not exist", async () => {
    renderWithRouter(
      <EditNoteScreen noteId="00000000-0000-7000-8000-000000000999" onSaved={() => {}} />,
    );
    expect(await screen.findByText("Essa nota não existe mais.")).toBeInTheDocument();
  });
});
