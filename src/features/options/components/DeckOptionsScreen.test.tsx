import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithRouter } from "../../../../tests/render";
import { setupRuntime } from "../../../../tests/runtime";
import { ensureSeed, SEED_IDS } from "../../../data/seed";
import { type Deck, defaultPresetValues } from "../../../domain/model";
import { t } from "../../../i18n/pt-BR";
import { DeckOptionsScreen } from "./DeckOptionsScreen";

const NOW = Date.parse("2026-11-16T15:00:00Z");
let rt: ReturnType<typeof setupRuntime>;
let deck: Deck;

beforeEach(async () => {
  rt = setupRuntime({ now: NOW });
  await ensureSeed(rt, t.seed);
  deck = await rt.repos.decks.createByPath("Inglês", SEED_IDS.preset);
});

const save = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Opções salvas.");
};
const stepper = (name: string) => screen.getByRole("spinbutton", { name });
async function setNumber(name: string, value: string) {
  const input = await screen.findByRole("spinbutton", { name });
  await userEvent.clear(input);
  await userEvent.type(input, value);
}

describe("DeckOptionsScreen", () => {
  it("shows the deck's preset and its options", async () => {
    renderWithRouter(<DeckOptionsScreen deckId={deck.id} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Opções" })).toBeInTheDocument();
    expect(screen.getByText("Inglês")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Predefinição" })).toHaveDisplayValue("Padrão");
    expect(screen.getByText("Usada por 1 baralho")).toBeInTheDocument();
    expect(stepper("Novos por dia")).toHaveValue(20);
    expect(stepper("Revisões por dia")).toHaveValue(200);
    expect(screen.getByRole("textbox", { name: "Etapas de aprendizado" })).toHaveValue("1m 10m");
    expect(screen.getByRole("slider", { name: "Retenção desejada" })).toHaveAttribute(
      "aria-valuetext",
      "90%",
    );
  });

  it("saves preset changes", async () => {
    renderWithRouter(<DeckOptionsScreen deckId={deck.id} />);
    await setNumber("Novos por dia", "30");
    const steps = await screen.findByRole("textbox", { name: "Etapas de aprendizado" });
    await userEvent.clear(steps);
    await userEvent.type(steps, "2m 15m");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Ordem dos novos" }),
      "Aleatória",
    );
    await userEvent.click(screen.getByRole("switch", { name: "Mostrar cronômetro" }));
    fireEvent.change(screen.getByRole("slider", { name: "Retenção desejada" }), {
      target: { value: "0.85" },
    });
    await save();
    expect(await rt.db.presets.get(SEED_IDS.preset)).toMatchObject({
      newPerDay: 30,
      learningSteps: ["2m", "15m"],
      newCardOrder: "random",
      showTimer: true,
      desiredRetention: 0.85,
    });
  });

  it("refuses invalid steps", async () => {
    renderWithRouter(<DeckOptionsScreen deckId={deck.id} />);
    const steps = await screen.findByRole("textbox", { name: "Etapas de reaprendizado" });
    await userEvent.clear(steps);
    await userEvent.type(steps, "10 minutos");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Use etapas como 1m 10m 1h 2d.");
    expect((await rt.db.presets.get(SEED_IDS.preset))?.relearningSteps).toEqual(["10m"]);
  });

  it("can limit new cards for this deck only", async () => {
    renderWithRouter(<DeckOptionsScreen deckId={deck.id} />);
    const scope = await screen.findByRole("radiogroup", { name: "Aplicar limite de novos" });
    await userEvent.click(within(scope).getByRole("radio", { name: "Só este baralho" }));
    await setNumber("Novos por dia", "5");
    await save();
    expect((await rt.db.decks.get(deck.id))?.overrides).toEqual({ newPerDay: 5 });
    expect((await rt.db.presets.get(SEED_IDS.preset))?.newPerDay).toBe(20);
  });

  it("can limit reviews for today only", async () => {
    renderWithRouter(<DeckOptionsScreen deckId={deck.id} />);
    const scope = await screen.findByRole("radiogroup", { name: "Aplicar limite de revisões" });
    await userEvent.click(within(scope).getByRole("radio", { name: "Só hoje" }));
    await setNumber("Revisões por dia", "15");
    await save();
    expect((await rt.db.decks.get(deck.id))?.overrides).toEqual({
      todayOnly: { day: "2026-11-16", reviewsPerDay: 15 },
    });
  });

  it("clones the preset and switches the deck to the copy", async () => {
    renderWithRouter(<DeckOptionsScreen deckId={deck.id} />);
    await setNumber("Novos por dia", "7");
    await userEvent.click(screen.getByRole("button", { name: "Clonar predefinição" }));
    const dialog = screen.getByRole("dialog", { name: "Clonar predefinição" });
    const name = within(dialog).getByRole("textbox", { name: "Nome" });
    expect(name).toHaveValue("Padrão (cópia)");
    await userEvent.clear(name);
    await userEvent.type(name, "Intenso");
    await userEvent.click(within(dialog).getByRole("button", { name: "Criar" }));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Predefinição" })).toHaveDisplayValue("Intenso"),
    );
    const updated = await rt.db.decks.get(deck.id);
    const clone = await rt.db.presets.get(updated?.presetId ?? "");
    expect(clone).toMatchObject({ name: "Intenso", newPerDay: 7 });
    expect(stepper("Novos por dia")).toHaveValue(7);
  });

  it("renames the preset", async () => {
    renderWithRouter(<DeckOptionsScreen deckId={deck.id} />);
    await userEvent.click(await screen.findByRole("button", { name: "Renomear predefinição" }));
    const dialog = screen.getByRole("dialog", { name: "Renomear predefinição" });
    const name = within(dialog).getByRole("textbox", { name: "Nome" });
    await userEvent.clear(name);
    await userEvent.type(name, "Básica");
    await userEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Predefinição" })).toHaveDisplayValue("Básica"),
    );
  });

  it("deletes a custom preset, moving its decks back to the default", async () => {
    const custom = await rt.repos.presets.clone("Intenso", defaultPresetValues());
    await rt.repos.decks.update(deck.id, { presetId: custom.id });
    renderWithRouter(<DeckOptionsScreen deckId={deck.id} />);
    await userEvent.click(await screen.findByRole("button", { name: "Excluir predefinição" }));
    const dialog = screen.getByRole("dialog", { name: "Excluir “Intenso”?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Predefinição" })).toHaveDisplayValue("Padrão"),
    );
    expect((await rt.db.decks.get(deck.id))?.presetId).toBe(SEED_IDS.preset);
  });

  it("does not offer deleting the default preset", async () => {
    renderWithRouter(<DeckOptionsScreen deckId={deck.id} />);
    await screen.findByRole("combobox", { name: "Predefinição" });
    expect(screen.queryByRole("button", { name: "Excluir predefinição" })).not.toBeInTheDocument();
  });

  it("restores the preset's defaults", async () => {
    await rt.repos.presets.update(SEED_IDS.preset, { newPerDay: 99, showTimer: true });
    renderWithRouter(<DeckOptionsScreen deckId={deck.id} />);
    await userEvent.click(await screen.findByRole("button", { name: "Restaurar padrões" }));
    const dialog = screen.getByRole("dialog", { name: "Restaurar padrões?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Restaurar" }));
    await waitFor(() => expect(stepper("Novos por dia")).toHaveValue(20));
    expect((await rt.db.presets.get(SEED_IDS.preset))?.showTimer).toBe(false);
  });

  it("switches the deck to another preset on save", async () => {
    const custom = await rt.repos.presets.clone("Leve", { ...defaultPresetValues(), newPerDay: 5 });
    renderWithRouter(<DeckOptionsScreen deckId={deck.id} />);
    await userEvent.selectOptions(
      await screen.findByRole("combobox", { name: "Predefinição" }),
      "Leve",
    );
    expect(stepper("Novos por dia")).toHaveValue(5);
    await save();
    expect((await rt.db.decks.get(deck.id))?.presetId).toBe(custom.id);
  });

  it("says so when the deck does not exist", async () => {
    renderWithRouter(<DeckOptionsScreen deckId="00000000-0000-7000-8000-000000000999" />);
    expect(await screen.findByText("Esse baralho não existe mais.")).toBeInTheDocument();
  });
});
