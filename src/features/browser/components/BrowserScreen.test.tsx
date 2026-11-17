import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "../../../../tests/render";
import { setupRuntime } from "../../../../tests/runtime";
import { ensureSeed, SEED_IDS } from "../../../data/seed";
import type { Deck, Note } from "../../../domain/model";
import { t } from "../../../i18n/pt-BR";
import { BrowserScreen, type BrowserSearch } from "./BrowserScreen";

const NOW = Date.parse("2026-11-16T15:00:00Z");
let rt: ReturnType<typeof setupRuntime>;
let ingles: Deck;
let math: Deck;
let cat: Note;
let dog: Note;

beforeEach(async () => {
  rt = setupRuntime({ now: NOW });
  await ensureSeed(rt, t.seed);
  ingles = await rt.repos.decks.createByPath("Inglês", SEED_IDS.preset);
  math = await rt.repos.decks.createByPath("Matemática", SEED_IDS.preset);
  const add = async (front: string, back: string, noteTypeId: string = SEED_IDS.basic) => {
    const { note } = await rt.repos.notes.add({
      noteTypeId,
      deckId: ingles.id,
      fields: { front, back },
      tags: [],
    });
    rt.clock.advance(1);
    return note;
  };
  cat = await add("cat", "gato", SEED_IDS.basicReversed);
  dog = await add("dog", "cão");
});

function open(search: Partial<BrowserSearch> = {}) {
  const onSearchChange = vi.fn();
  renderWithRouter(
    <BrowserScreen
      search={{ q: "", sort: "added", mode: "cards", ...search }}
      onSearchChange={onSearchChange}
    />,
  );
  return { onSearchChange };
}

const results = () => screen.findByRole("list", { name: "Resultados" });
const rowTexts = () =>
  within(screen.getByRole("list", { name: "Resultados" }))
    .getAllByRole("link")
    .map((a) => a.textContent);

describe("BrowserScreen", () => {
  it("lists every card, newest first, with its deck and status", async () => {
    open();
    await results();
    expect(rowTexts()).toEqual(["dog", "cat", "cat"]);
    expect(screen.getByText("3 cartões")).toBeInTheDocument();
    const first = screen.getAllByRole("listitem")[0] as HTMLElement;
    expect(first).toHaveTextContent("Inglês");
    expect(first).toHaveTextContent("Novo");
    expect(within(first).getByRole("link", { name: "dog" })).toHaveAttribute(
      "href",
      `/notes/${dog.id}/edit`,
    );
  });

  it("filters with the search box and reports the query", async () => {
    const { onSearchChange } = open();
    await results();
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar cartões" }), "gato");
    await waitFor(() => expect(rowTexts()).toEqual(["cat", "cat"]));
    expect(onSearchChange).toHaveBeenLastCalledWith({ q: "gato", sort: "added", mode: "cards" });
  });

  it("starts from the given search", async () => {
    open({ q: "dog" });
    await results();
    expect(rowTexts()).toEqual(["dog"]);
  });

  it("toggles quick filters", async () => {
    await rt.repos.bulk.setSuspended(
      [(await rt.db.cards.where("noteId").equals(dog.id).first())?.id ?? ""],
      true,
    );
    open();
    await results();
    const chip = screen.getByRole("button", { name: "Suspensos" });
    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("searchbox", { name: "Buscar cartões" })).toHaveValue("is:suspended");
    await waitFor(() => expect(rowTexts()).toEqual(["dog"]));
    await userEvent.click(chip);
    await waitFor(() => expect(rowTexts()).toHaveLength(3));
  });

  it("shows one row per note in notes mode", async () => {
    open();
    await results();
    await userEvent.click(screen.getByRole("button", { name: "Notas" }));
    await waitFor(() => expect(rowTexts()).toEqual(["dog", "cat"]));
    expect(screen.getByText("2 notas")).toBeInTheDocument();
  });

  it("sorts by text", async () => {
    open();
    await results();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Ordenar por" }), "Texto");
    await waitFor(() => expect(rowTexts()).toEqual(["cat", "cat", "dog"]));
  });

  it("says so when nothing matches", async () => {
    open({ q: "zebra" });
    expect(await screen.findByText("Nenhum cartão encontrado.")).toBeInTheDocument();
  });

  async function select(...names: string[]) {
    await results();
    for (const name of names) {
      const box = screen.getAllByRole("checkbox", { name: `Selecionar ${name}` })[0] as HTMLElement;
      await userEvent.click(box);
    }
  }
  const bar = () => screen.getByRole("region", { name: "Seleção" });
  async function action(name: string) {
    await userEvent.click(within(bar()).getByRole("button", { name: "Ações" }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Ações" })).getByRole("button", { name }),
    );
  }

  it("selects rows, or all of them", async () => {
    open();
    await select("dog");
    expect(bar()).toHaveTextContent("1 selecionado");
    await userEvent.click(within(bar()).getByRole("button", { name: "Selecionar todos" }));
    expect(bar()).toHaveTextContent("3 selecionados");
    await userEvent.click(within(bar()).getByRole("button", { name: "Limpar seleção" }));
    expect(screen.queryByRole("region", { name: "Seleção" })).not.toBeInTheDocument();
  });

  it("suspends and reactivates the selected cards", async () => {
    open();
    await select("dog");
    await action("Suspender");
    await waitFor(async () =>
      expect((await rt.db.cards.where("noteId").equals(dog.id).first())?.queue).toBe("suspended"),
    );
    await select("dog");
    await action("Reativar");
    await waitFor(async () =>
      expect((await rt.db.cards.where("noteId").equals(dog.id).first())?.queue).toBe("new"),
    );
  });

  it("moves the selected cards to another deck", async () => {
    open();
    await select("dog");
    await action("Mover");
    const dialog = screen.getByRole("dialog", { name: "Mover cartões" });
    await userEvent.selectOptions(
      within(dialog).getByRole("combobox", { name: "Baralho" }),
      "Matemática",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Mover" }));
    await waitFor(async () =>
      expect((await rt.db.cards.where("noteId").equals(dog.id).first())?.deckId).toBe(math.id),
    );
  });

  it("adds tags to the notes of the selected cards", async () => {
    open();
    await select("dog", "cat");
    await action("Etiquetar");
    const dialog = screen.getByRole("dialog", { name: "Etiquetar" });
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Etiquetas" }), "Animais");
    await userEvent.click(within(dialog).getByRole("button", { name: "Adicionar etiquetas" }));
    await waitFor(async () => expect((await rt.db.notes.get(cat.id))?.tags).toEqual(["animais"]));
    expect((await rt.db.notes.get(dog.id))?.tags).toEqual(["animais"]);
  });

  it("reschedules the selected cards", async () => {
    const card = await rt.db.cards.where("noteId").equals(dog.id).first();
    await rt.db.cards.update(card?.id ?? "", {
      queue: "review",
      state: "review",
      reps: 1,
      stability: 3,
      difficulty: 5,
      lastReviewAt: NOW,
    });
    open();
    await select("dog");
    await action("Reagendar");
    const dialog = screen.getByRole("dialog", { name: "Reagendar" });
    await userEvent.clear(within(dialog).getByRole("spinbutton", { name: "Daqui a quantos dias" }));
    await userEvent.type(
      within(dialog).getByRole("spinbutton", { name: "Daqui a quantos dias" }),
      "10",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Reagendar" }));
    await waitFor(async () =>
      expect((await rt.db.cards.get(card?.id ?? ""))?.scheduledDays).toBe(10),
    );
  });

  it("forgets the selected cards after confirmation", async () => {
    const card = await rt.db.cards.where("noteId").equals(dog.id).first();
    await rt.db.cards.update(card?.id ?? "", {
      queue: "review",
      state: "review",
      reps: 4,
      stability: 3,
      difficulty: 5,
      lastReviewAt: NOW,
    });
    open();
    await select("dog");
    await action("Esquecer");
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Esquecer cartões?" })).getByRole("button", {
        name: "Esquecer",
      }),
    );
    await waitFor(async () => expect((await rt.db.cards.get(card?.id ?? ""))?.reps).toBe(0));
  });

  it("deletes the notes of the selected cards after confirmation", async () => {
    open();
    await select("dog");
    await action("Excluir");
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Excluir notas?" })).getByRole("button", {
        name: "Excluir",
      }),
    );
    await waitFor(() => expect(rowTexts()).toEqual(["cat", "cat"]));
    expect((await rt.db.notes.get(dog.id))?.deletedAt).not.toBeNull();
  });
});
