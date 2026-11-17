import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "../../../../tests/render";
import { setupRuntime } from "../../../../tests/runtime";
import { ensureSeed, SEED_IDS } from "../../../data/seed";
import { t } from "../../../i18n/pt-BR";
import { NoteTypeEditorScreen, NoteTypesScreen } from "./NoteTypes";

let rt: ReturnType<typeof setupRuntime>;
beforeEach(async () => {
  rt = setupRuntime();
  await ensureSeed(rt, t.seed);
});

describe("NoteTypesScreen", () => {
  it("lists note types with how many notes use them, linking to the editor", async () => {
    const deck = await rt.repos.decks.createByPath("Inglês", SEED_IDS.preset);
    await rt.repos.notes.add({
      noteTypeId: SEED_IDS.basic,
      deckId: deck.id,
      fields: { front: "cat" },
      tags: [],
    });
    renderWithRouter(<NoteTypesScreen />);
    const list = await screen.findByRole("list", { name: "Tipos de nota" });
    const basic = within(list).getByRole("link", { name: /^Básico ?\d/ });
    expect(basic).toHaveAttribute("href", `/note-types/${SEED_IDS.basic}`);
    expect(basic).toHaveTextContent("1 nota");
  });

  it("creates a note type from an existing one", async () => {
    renderWithRouter(<NoteTypesScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Novo tipo de nota" }));
    const dialog = screen.getByRole("dialog", { name: "Novo tipo de nota" });
    await userEvent.selectOptions(
      within(dialog).getByRole("combobox", { name: "Baseado em" }),
      "Omissão",
    );
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Nome" }), "Minha omissão");
    await userEvent.click(within(dialog).getByRole("button", { name: "Criar" }));
    expect(await screen.findByRole("link", { name: /Minha omissão/ })).toBeInTheDocument();
    expect((await rt.db.noteTypes.toArray()).find((nt) => nt.name === "Minha omissão")?.kind).toBe(
      "cloze",
    );
  });

  it("deletes an unused note type and explains when one is in use", async () => {
    const clone = await rt.repos.noteTypes.cloneFrom(SEED_IDS.basic, "Extra");
    const deck = await rt.repos.decks.createByPath("Inglês", SEED_IDS.preset);
    await rt.repos.notes.add({
      noteTypeId: SEED_IDS.basic,
      deckId: deck.id,
      fields: { front: "x" },
      tags: [],
    });
    renderWithRouter(<NoteTypesScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Excluir Extra" }));
    await waitFor(async () =>
      expect((await rt.db.noteTypes.get(clone.id))?.deletedAt).not.toBeNull(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Excluir Básico" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esse tipo de nota tem notas; exclua ou mova as notas antes.",
    );
  });
});

describe("NoteTypeEditorScreen", () => {
  const field = (n: number) => screen.getByRole("textbox", { name: `Nome do campo ${n}` });

  it("renames a field, updating the templates, and saves", async () => {
    const onSaved = vi.fn();
    renderWithRouter(<NoteTypeEditorScreen noteTypeId={SEED_IDS.basic} onSaved={onSaved} />);
    await screen.findByRole("heading", { level: 1, name: "Básico" });
    await userEvent.clear(field(2));
    await userEvent.type(field(2), "Resposta");
    await userEvent.tab();
    expect(screen.getByRole("textbox", { name: "Verso do cartão" })).toHaveValue(
      "{{FrontSide}}<hr id=answer>{{Resposta}}",
    );
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect((await rt.db.noteTypes.get(SEED_IDS.basic))?.fields.map((f) => f.name)).toEqual([
      "Frente",
      "Resposta",
    ]);
  });

  it("refuses a duplicate field name", async () => {
    renderWithRouter(<NoteTypeEditorScreen noteTypeId={SEED_IDS.basic} onSaved={() => {}} />);
    await screen.findByRole("heading", { level: 1, name: "Básico" });
    await userEvent.clear(field(2));
    await userEvent.type(field(2), "Frente");
    await userEvent.tab();
    expect(await screen.findByRole("alert")).toHaveTextContent("Já existe um campo com esse nome.");
    expect(field(2)).toHaveValue("Verso");
  });

  it("adds, moves and removes fields", async () => {
    renderWithRouter(<NoteTypeEditorScreen noteTypeId={SEED_IDS.basic} onSaved={() => {}} />);
    await screen.findByRole("heading", { level: 1, name: "Básico" });
    await userEvent.type(screen.getByRole("textbox", { name: "Novo campo" }), "Exemplo");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar campo" }));
    expect(field(3)).toHaveValue("Exemplo");
    await userEvent.click(screen.getByRole("button", { name: "Subir Exemplo" }));
    expect(field(2)).toHaveValue("Exemplo");
    await userEvent.click(screen.getByRole("button", { name: "Remover Exemplo" }));
    expect(screen.queryByRole("textbox", { name: "Nome do campo 3" })).not.toBeInTheDocument();
  });

  it("edits a card's templates and CSS with a live preview", async () => {
    renderWithRouter(<NoteTypeEditorScreen noteTypeId={SEED_IDS.basic} onSaved={() => {}} />);
    await screen.findByRole("heading", { level: 1, name: "Básico" });
    const front = screen.getByRole("textbox", { name: "Frente do cartão" });
    await userEvent.clear(front);
    await userEvent.type(front, "Pergunta: {{{{Frente}}");
    const preview = screen.getByRole("region", { name: "Pré-visualização do cartão" });
    await waitFor(() => expect(preview).toHaveTextContent("Pergunta: (Frente)"));
    expect(screen.getByRole("textbox", { name: "Estilo (CSS)" })).toBeInTheDocument();
  });

  it("adds and removes card types", async () => {
    renderWithRouter(<NoteTypeEditorScreen noteTypeId={SEED_IDS.basic} onSaved={() => {}} />);
    await screen.findByRole("heading", { level: 1, name: "Básico" });
    expect(screen.queryByRole("button", { name: "Remover este cartão" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Adicionar tipo de cartão" }));
    expect(screen.getByRole("combobox", { name: "Tipo de cartão" })).toHaveDisplayValue("Cartão 2");
    await userEvent.click(screen.getByRole("button", { name: "Remover este cartão" }));
    expect(screen.getByRole("combobox", { name: "Tipo de cartão" })).toHaveDisplayValue("Cartão 1");
  });
});
