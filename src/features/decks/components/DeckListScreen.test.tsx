import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { makeCard } from "../../../../tests/factories";
import { renderWithRouter } from "../../../../tests/render";
import { setupRuntime } from "../../../../tests/runtime";
import { SEED_IDS } from "../../../data/seed";
import { DeckListScreen } from "./DeckListScreen";

const PRESET = SEED_IDS.preset;
const NOW = Date.parse("2026-11-16T15:00:00Z");

async function setup() {
  const rt = setupRuntime({ now: NOW });
  await rt.repos.presets.create({}).then((p) => rt.db.presets.put({ ...p, id: PRESET }));
  return rt;
}

const list = () => screen.findByRole("list", { name: "Lista de baralhos" });
const rowNames = async () =>
  within(await list())
    .getAllByRole("link")
    .map((a) => a.textContent);
/** Synchronous version for use inside waitFor. */
const rowNamesNow = () =>
  within(screen.getByRole("list", { name: "Lista de baralhos" }))
    .getAllByRole("link")
    .map((a) => a.textContent);

describe("DeckListScreen", () => {
  it("shows an empty state that invites creating a deck", async () => {
    await setup();
    renderWithRouter(<DeckListScreen />);
    expect(await screen.findByText("Nenhum baralho ainda.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo baralho" })).toBeInTheDocument();
  });

  it("lists decks as a tree with today's counts", async () => {
    const { repos, db } = await setup();
    const leaf = await repos.decks.createByPath("Inglês::Phrasal verbs", PRESET);
    await db.cards.bulkAdd([
      makeCard({ deckId: leaf.id }),
      makeCard({ deckId: leaf.id, queue: "review", state: "review", due: NOW - 1, reps: 1 }),
    ]);
    renderWithRouter(<DeckListScreen />);
    expect(await rowNames()).toEqual(["Inglês", "Phrasal verbs"]);
    const row = screen.getByRole("link", { name: "Phrasal verbs" }).closest("li") as HTMLElement;
    expect(within(row).getByText("1 novo, 0 aprendendo, 1 para revisar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inglês" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/decks\/.+/),
    );
  });

  it("summarises today's cards", async () => {
    const { repos, db } = await setup();
    const deck = await repos.decks.createByPath("Inglês", PRESET);
    await db.cards.bulkAdd([
      makeCard({ deckId: deck.id }),
      makeCard({ deckId: deck.id, newPosition: 1 }),
    ]);
    renderWithRouter(<DeckListScreen />);
    const summary = await screen.findByRole("region", { name: "Hoje" });
    expect(summary).toHaveTextContent("2 cartões");
    expect(summary).toHaveTextContent("~1 min");
  });

  it("creates nested decks from a :: path", async () => {
    await setup();
    renderWithRouter(<DeckListScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Novo baralho" }));
    const dialog = screen.getByRole("dialog", { name: "Novo baralho" });
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Nome" }), "Inglês::Idioms");
    await userEvent.click(within(dialog).getByRole("button", { name: "Criar" }));
    await waitFor(() => expect(rowNamesNow()).toEqual(["Inglês", "Idioms"]));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("explains why a deck cannot be created", async () => {
    const { repos } = await setup();
    await repos.decks.createByPath("Inglês", PRESET);
    renderWithRouter(<DeckListScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Novo baralho" }));
    const dialog = screen.getByRole("dialog", { name: "Novo baralho" });
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Nome" }), "inglês");
    await userEvent.click(within(dialog).getByRole("button", { name: "Criar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Já existe um baralho com esse caminho.",
    );
  });

  it("collapses and expands a deck, remembering the choice", async () => {
    const { repos, db } = await setup();
    await repos.decks.createByPath("Inglês::Idioms", PRESET);
    renderWithRouter(<DeckListScreen />);
    const toggle = await screen.findByRole("button", { name: "Recolher Inglês" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(toggle);
    await waitFor(() => expect(rowNamesNow()).toEqual(["Inglês"]));
    expect(screen.getByRole("button", { name: "Expandir Inglês" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect((await db.decks.filter((d) => d.name === "Inglês").first())?.collapsed).toBe(true);
  });

  it("filters decks by search", async () => {
    const { repos } = await setup();
    await repos.decks.createByPath("Inglês::Idioms", PRESET);
    await repos.decks.createByPath("Matemática", PRESET);
    renderWithRouter(<DeckListScreen />);
    await list();
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar baralhos" }), "mate");
    await waitFor(() => expect(rowNamesNow()).toEqual(["Matemática"]));
    await userEvent.type(screen.getByRole("searchbox"), "xyz");
    expect(await screen.findByText("Nenhum baralho encontrado.")).toBeInTheDocument();
  });

  async function openActions(name: string) {
    await userEvent.click(await screen.findByRole("button", { name: `Ações de ${name}` }));
    return screen.getByRole("dialog", { name });
  }

  it("renames a deck from its actions", async () => {
    const { repos } = await setup();
    await repos.decks.createByPath("Ingles", PRESET);
    renderWithRouter(<DeckListScreen />);
    const dialog = await openActions("Ingles");
    await userEvent.click(within(dialog).getByRole("button", { name: "Renomear" }));
    const field = within(screen.getByRole("dialog")).getByRole("textbox", { name: "Nome" });
    expect(field).toHaveValue("Ingles");
    await userEvent.clear(field);
    await userEvent.type(field, "Inglês");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(rowNamesNow()).toEqual(["Inglês"]));
  });

  it("creates a subdeck from a deck's actions", async () => {
    const { repos } = await setup();
    await repos.decks.createByPath("Inglês", PRESET);
    renderWithRouter(<DeckListScreen />);
    const dialog = await openActions("Inglês");
    await userEvent.click(within(dialog).getByRole("button", { name: "Criar subbaralho" }));
    const field = within(screen.getByRole("dialog")).getByRole("textbox", { name: "Nome" });
    await userEvent.type(field, "Idioms");
    await userEvent.click(screen.getByRole("button", { name: "Criar" }));
    await waitFor(() => expect(rowNamesNow()).toEqual(["Inglês", "Idioms"]));
  });

  it("moves a deck under another one", async () => {
    const { repos } = await setup();
    await repos.decks.createByPath("Idioms", PRESET);
    await repos.decks.createByPath("Inglês", PRESET);
    renderWithRouter(<DeckListScreen />);
    const dialog = await openActions("Idioms");
    await userEvent.click(within(dialog).getByRole("button", { name: "Mover" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Mover para" }), "Inglês");
    await userEvent.click(screen.getByRole("button", { name: "Mover" }));
    await waitFor(() => expect(rowNamesNow()).toEqual(["Inglês", "Idioms"]));
  });

  it("does not offer moving a deck into itself or its subdecks", async () => {
    const { repos } = await setup();
    await repos.decks.createByPath("Inglês::Idioms", PRESET);
    await repos.decks.createByPath("Matemática", PRESET);
    renderWithRouter(<DeckListScreen />);
    const dialog = await openActions("Inglês");
    await userEvent.click(within(dialog).getByRole("button", { name: "Mover" }));
    const options = within(screen.getByRole("combobox", { name: "Mover para" })).getAllByRole(
      "option",
    );
    expect(options.map((o) => o.textContent)).toEqual(["Nível superior", "Matemática"]);
  });

  it("deletes a deck after confirmation", async () => {
    const { repos } = await setup();
    await repos.decks.createByPath("Inglês::Idioms", PRESET);
    await repos.decks.createByPath("Matemática", PRESET);
    renderWithRouter(<DeckListScreen />);
    const dialog = await openActions("Inglês");
    await userEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    const confirm = screen.getByRole("dialog", { name: "Excluir “Inglês”?" });
    expect(confirm).toHaveAccessibleDescription(
      "O baralho, seus subbaralhos e cartões vão para a lixeira.",
    );
    await userEvent.click(within(confirm).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(rowNamesNow()).toEqual(["Matemática"]));
  });
});
