import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { makeCard, makeReviewLog } from "../../../../tests/factories";
import { renderWithRouter } from "../../../../tests/render";
import { setupRuntime } from "../../../../tests/runtime";
import { ensureSeed, SEED_IDS } from "../../../data/seed";
import type { Deck } from "../../../domain/model";
import { t } from "../../../i18n/pt-BR";
import { StatsScreen } from "./StatsScreen";

const NOW = Date.parse("2026-11-16T15:00:00Z");
const DAY = 86_400_000;
let rt: ReturnType<typeof setupRuntime>;
let ingles: Deck;
let math: Deck;

beforeEach(async () => {
  rt = setupRuntime({ now: NOW });
  await ensureSeed(rt, t.seed);
  ingles = await rt.repos.decks.createByPath("Inglês", SEED_IDS.preset);
  math = await rt.repos.decks.createByPath("Matemática", SEED_IDS.preset);
  const a = makeCard({ deckId: ingles.id, queue: "review", state: "review", reps: 3 });
  const b = makeCard({ deckId: math.id });
  await rt.db.cards.bulkAdd([a, b]);
  const log = (
    cardId: string,
    daysAgo: number,
    rating: number,
    stateBefore: "new" | "review" = "review",
  ) =>
    makeReviewLog({
      cardId,
      reviewedAt: NOW - daysAgo * DAY,
      rating,
      stateBefore,
      durationMs: 30_000,
    });
  await rt.db.reviewLogs.bulkAdd([
    log(a.id, 0, 3),
    log(a.id, 0, 1),
    log(a.id, 1, 4),
    log(a.id, 20, 3),
    log(b.id, 0, 3, "new"),
  ]);
});

const region = (name: string) => screen.findByRole("region", { name });

describe("StatsScreen", () => {
  it("summarises today for all decks", async () => {
    renderWithRouter(<StatsScreen />);
    const today = await region("Hoje");
    expect(within(today).getByText("Respostas").nextSibling).toHaveTextContent("3");
    expect(within(today).getByText("Tempo").nextSibling).toHaveTextContent("2 min");
    expect(within(today).getByText("Acertos").nextSibling).toHaveTextContent("67%");
    expect(within(today).getByText("De novo").nextSibling).toHaveTextContent("1");
  });

  it("shows the streak and true retention", async () => {
    renderWithRouter(<StatsScreen />);
    expect(await region("Sequência")).toHaveTextContent("2 dias");
    const retention = await region("Retenção real");
    expect(retention).toHaveTextContent("67%");
    expect(retention).toHaveTextContent("2 de 3 revisões");
  });

  it("charts reviews per day, with the numbers in a table", async () => {
    renderWithRouter(<StatsScreen />);
    const reviews = await region("Revisões");
    const rows = within(within(reviews).getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(8); // header + 7 days
    expect(rows.at(-1)).toHaveTextContent(/Hoje.*3/);
    expect(rows.at(-2)).toHaveTextContent(/1/);
  });

  it("changes the period", async () => {
    renderWithRouter(<StatsScreen />);
    await region("Revisões");
    await userEvent.click(screen.getByRole("radio", { name: "30 dias" }));
    await waitFor(async () =>
      expect(
        within(within(await region("Revisões")).getByRole("table")).getAllByRole("row"),
      ).toHaveLength(31),
    );
    expect(await region("Retenção real")).toHaveTextContent("3 de 4 revisões");
  });

  it("filters by deck", async () => {
    renderWithRouter(<StatsScreen />);
    await region("Hoje");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Baralho" }), "Matemática");
    await waitFor(async () =>
      expect(within(await region("Hoje")).getByText("Respostas").nextSibling).toHaveTextContent(
        "1",
      ),
    );
    expect(await region("Retenção real")).toHaveTextContent("Sem revisões no período");
  });

  it("counts cards by state, with a legend", async () => {
    renderWithRouter(<StatsScreen />);
    const states = await region("Estado dos cartões");
    expect(within(states).getByText("Novos: 1")).toBeInTheDocument();
    expect(within(states).getByText("Revisão: 1")).toBeInTheDocument();
  });

  it("counts answers per button", async () => {
    renderWithRouter(<StatsScreen />);
    const buttons = await region("Respostas por botão");
    expect(within(buttons).getByText("De novo").parentElement).toHaveTextContent("1");
    expect(within(buttons).getByText("Bom").parentElement).toHaveTextContent("2");
  });

  it("draws a year-long activity map", async () => {
    renderWithRouter(<StatsScreen />);
    const map = await region("Mapa de atividade");
    expect(within(map).getByRole("img", { name: /365 dias/ })).toBeInTheDocument();
  });
});
