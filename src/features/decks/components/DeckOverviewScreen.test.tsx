import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { makeCard } from "../../../../tests/factories";
import { renderWithRouter } from "../../../../tests/render";
import { setupRuntime } from "../../../../tests/runtime";
import { SEED_IDS } from "../../../data/seed";
import { DeckOverviewScreen } from "./DeckOverviewScreen";

const NOW = Date.parse("2026-11-16T15:00:00Z");
const DAY = 86_400_000;

async function setup() {
  const rt = setupRuntime({ now: NOW });
  await rt.repos.presets.create({}).then((p) => rt.db.presets.put({ ...p, id: SEED_IDS.preset }));
  return rt;
}

describe("DeckOverviewScreen", () => {
  it("shows the deck name, its path and a way back", async () => {
    const { repos } = await setup();
    const leaf = await repos.decks.createByPath("Inglês::Phrasal verbs", SEED_IDS.preset);
    renderWithRouter(<DeckOverviewScreen deckId={leaf.id} />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Phrasal verbs" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Inglês::Phrasal verbs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para baralhos" })).toHaveAttribute("href", "/");
  });

  it("links to studying this deck", async () => {
    const { repos } = await setup();
    const deck = await repos.decks.createByPath("Inglês", SEED_IDS.preset);
    renderWithRouter(<DeckOverviewScreen deckId={deck.id} />);
    expect(await screen.findByRole("link", { name: "Estudar" })).toHaveAttribute(
      "href",
      `/decks/${deck.id}/study`,
    );
  });

  it("offers custom study: forgotten today, reviews ahead and a tag", async () => {
    const { repos } = await setup();
    const deck = await repos.decks.createByPath("Inglês", SEED_IDS.preset);
    renderWithRouter(<DeckOverviewScreen deckId={deck.id} />);
    await userEvent.click(await screen.findByRole("button", { name: "Estudo personalizado" }));
    const sheet = screen.getByRole("dialog", { name: "Estudo personalizado" });
    const base = `/decks/${deck.id}/study`;
    expect(within(sheet).getByRole("link", { name: /Esquecidos hoje/ })).toHaveAttribute(
      "href",
      `${base}?custom=forgotten`,
    );
    expect(within(sheet).getByRole("link", { name: "Adiantar 3 dias" })).toHaveAttribute(
      "href",
      `${base}?custom=ahead&days=3`,
    );
    await userEvent.click(within(sheet).getByRole("button", { name: "Aumentar Quantos dias" }));
    expect(within(sheet).getByRole("link", { name: "Adiantar 4 dias" })).toHaveAttribute(
      "href",
      `${base}?custom=ahead&days=4`,
    );
    expect(within(sheet).queryByRole("link", { name: "Estudar etiqueta" })).not.toBeInTheDocument();
    await userEvent.type(within(sheet).getByRole("textbox", { name: "Etiqueta" }), "verbos");
    expect(within(sheet).getByRole("link", { name: "Estudar etiqueta" })).toHaveAttribute(
      "href",
      `${base}?custom=tag&tag=verbos`,
    );
  });

  it("links to the deck's options", async () => {
    const { repos } = await setup();
    const deck = await repos.decks.createByPath("Inglês", SEED_IDS.preset);
    renderWithRouter(<DeckOverviewScreen deckId={deck.id} />);
    expect(await screen.findByRole("link", { name: "Opções do baralho" })).toHaveAttribute(
      "href",
      `/decks/${deck.id}/options`,
    );
  });

  it("links to adding a card to this deck", async () => {
    const { repos } = await setup();
    const deck = await repos.decks.createByPath("Inglês", SEED_IDS.preset);
    renderWithRouter(<DeckOverviewScreen deckId={deck.id} />);
    expect(await screen.findByRole("link", { name: "Adicionar cartão" })).toHaveAttribute(
      "href",
      `/add?deckId=${deck.id}`,
    );
  });

  it("shows today's counts with labels and an estimate", async () => {
    const { repos, db } = await setup();
    const deck = await repos.decks.createByPath("Inglês", SEED_IDS.preset);
    await db.cards.bulkAdd([
      makeCard({ deckId: deck.id }),
      makeCard({ deckId: deck.id, queue: "review", state: "review", due: NOW - 1, reps: 1 }),
      makeCard({ deckId: deck.id, queue: "review", state: "review", due: NOW - 2, reps: 1 }),
    ]);
    renderWithRouter(<DeckOverviewScreen deckId={deck.id} />);
    const counts = await screen.findByRole("list", { name: "Hoje" });
    expect(
      within(counts)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["1Novos", "0Aprendendo", "2Revisar"]);
    expect(screen.getByText("Cerca de 1 min hoje")).toBeInTheDocument();
  });

  it("forecasts the next 7 days", async () => {
    const { repos, db } = await setup();
    const deck = await repos.decks.createByPath("Inglês", SEED_IDS.preset);
    await db.cards.bulkAdd([
      makeCard({ deckId: deck.id, queue: "review", state: "review", due: NOW + DAY, reps: 1 }),
      makeCard({ deckId: deck.id, queue: "review", state: "review", due: NOW + DAY + 5, reps: 1 }),
    ]);
    renderWithRouter(<DeckOverviewScreen deckId={deck.id} />);
    const forecast = await screen.findByRole("list", { name: "Próximos 7 dias" });
    const items = within(forecast).getAllByRole("listitem");
    expect(items).toHaveLength(7);
    expect(items[0]).toHaveAccessibleName("Hoje: 0 cartões");
    expect(items[1]).toHaveAccessibleName("Amanhã: 2 cartões");
    expect(items[2]).toHaveAccessibleName("qua.: 0 cartões");
  });

  it("links to subdecks", async () => {
    const { repos } = await setup();
    await repos.decks.createByPath("Inglês::Idioms", SEED_IDS.preset);
    const ingles = (await repos.decks.listActive()).find((d) => d.name === "Inglês");
    renderWithRouter(<DeckOverviewScreen deckId={ingles?.id ?? ""} />);
    const subdecks = await screen.findByRole("list", { name: "Subbaralhos" });
    expect(within(subdecks).getByRole("link", { name: /Idioms/ })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/decks\//),
    );
  });

  it("says so when the deck does not exist", async () => {
    await setup();
    renderWithRouter(<DeckOverviewScreen deckId="00000000-0000-7000-b000-0000000000ff" />);
    expect(await screen.findByText("Esse baralho não existe mais.")).toBeInTheDocument();
  });
});
