import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeReviewLog } from "../../../../tests/factories";
import { renderWithRouter } from "../../../../tests/render";
import { setupRuntime } from "../../../../tests/runtime";
import { ensureSeed, SEED_IDS } from "../../../data/seed";
import type { Deck } from "../../../domain/model";
import { t } from "../../../i18n/pt-BR";
import { StudyScreen } from "./StudyScreen";

const NOW = Date.parse("2026-11-16T15:00:00Z");
const DAY = 86_400_000;

let rt: ReturnType<typeof setupRuntime>;
let deck: Deck;

beforeEach(async () => {
  rt = setupRuntime({ now: NOW });
  await ensureSeed(rt, t.seed);
  await rt.repos.presets.update(SEED_IDS.preset, { learningSteps: ["1m", "10m"] });
  deck = await rt.repos.decks.createByPath("Inglês", SEED_IDS.preset);
});

async function addNote(front: string, back: string) {
  const { note, cards } = await rt.repos.notes.add({
    noteTypeId: SEED_IDS.basic,
    deckId: deck.id,
    fields: { front, back },
    tags: [],
  });
  rt.clock.advance(1);
  return { note, card: cards[0] as NonNullable<(typeof cards)[0]> };
}

const card = () => screen.findByTestId("card-content");
const showAnswer = () => userEvent.click(screen.getByRole("button", { name: "Mostrar resposta" }));
const answerButton = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });

describe("StudyScreen", () => {
  it("shows the front, then the answer with the four ratings and their intervals", async () => {
    await addNote("cat", "gato");
    renderWithRouter(<StudyScreen deckId={deck.id} />);
    expect(await card()).toHaveTextContent(/^cat$/);
    expect(screen.queryByRole("button", { name: /^Bom/ })).not.toBeInTheDocument();
    await showAnswer();
    await waitFor(() => expect(screen.getByTestId("card-content")).toHaveTextContent("gato"));
    expect(answerButton("De novo")).toHaveTextContent("1 min");
    expect(answerButton("Bom")).toHaveTextContent("10 min");
    expect(answerButton("Difícil")).toBeInTheDocument();
    expect(answerButton("Fácil")).toHaveTextContent(/dia/);
  });

  it("saves each answer and moves on until the deck is done", async () => {
    const first = await addNote("cat", "gato");
    await addNote("dog", "cão");
    renderWithRouter(<StudyScreen deckId={deck.id} />);
    expect(await card()).toHaveTextContent("cat");
    await showAnswer();
    await userEvent.click(answerButton("Fácil"));
    await waitFor(() => expect(screen.getByTestId("card-content")).toHaveTextContent(/^dog$/));
    await showAnswer();
    await userEvent.click(answerButton("Fácil"));
    expect(
      await screen.findByText("Tudo em dia! Nada mais para estudar neste baralho hoje."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para o baralho" })).toHaveAttribute(
      "href",
      `/decks/${deck.id}`,
    );
    await waitFor(async () => expect(await rt.db.reviewLogs.count()).toBe(2));
    expect((await rt.db.cards.get(first.card.id))?.queue).toBe("review");
  });

  it("shows today's counts", async () => {
    await addNote("cat", "gato");
    await addNote("dog", "cão");
    renderWithRouter(<StudyScreen deckId={deck.id} />);
    expect(await screen.findByText("2 novos, 0 aprendendo, 0 para revisar")).toBeInTheDocument();
    await showAnswer();
    await userEvent.click(answerButton("Bom"));
    expect(await screen.findByText("1 novo, 1 aprendendo, 0 para revisar")).toBeInTheDocument();
  });

  it("answers with the keyboard: space shows the answer, 1–4 rate", async () => {
    const { card: c } = await addNote("cat", "gato");
    renderWithRouter(<StudyScreen deckId={deck.id} />);
    await card();
    await userEvent.keyboard(" ");
    await waitFor(() => expect(screen.getByTestId("card-content")).toHaveTextContent("gato"));
    await userEvent.keyboard("4");
    await screen.findByText("Tudo em dia! Nada mais para estudar neste baralho hoje.");
    await waitFor(async () =>
      expect((await rt.db.reviewLogs.toArray()).map((l) => [l.cardId, l.rating])).toEqual([
        [c.id, 4],
      ]),
    );
  });

  it("swipes left for Again and right for Good once the answer is shown", async () => {
    await addNote("cat", "gato");
    renderWithRouter(<StudyScreen deckId={deck.id} />);
    const area = await screen.findByTestId("study-card");
    const swipe = (from: number, to: number) => {
      fireEvent.pointerDown(area, { clientX: from, pointerId: 1, pointerType: "touch" });
      fireEvent.pointerUp(area, { clientX: to, pointerId: 1, pointerType: "touch" });
    };
    swipe(300, 100);
    expect(await rt.db.reviewLogs.count()).toBe(0);
    await showAnswer();
    swipe(300, 100);
    await waitFor(async () =>
      expect((await rt.db.reviewLogs.toArray()).map((l) => l.rating)).toEqual([1]),
    );
  });

  it("does not answer when the mouse drags across the card to select text", async () => {
    await addNote("cat", "gato");
    renderWithRouter(<StudyScreen deckId={deck.id} />);
    const area = await screen.findByTestId("study-card");
    await showAnswer();
    fireEvent.pointerDown(area, { clientX: 300, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerUp(area, { clientX: 100, pointerId: 1, pointerType: "mouse" });
    await new Promise((r) => setTimeout(r, 50));
    expect(await rt.db.reviewLogs.count()).toBe(0);
    expect(screen.getByRole("button", { name: /^De novo/ })).toBeInTheDocument();
  });

  it("undoes the last answer, showing the card again", async () => {
    const { card: c } = await addNote("cat", "gato");
    await addNote("dog", "cão");
    renderWithRouter(<StudyScreen deckId={deck.id} />);
    await card();
    expect(screen.getByRole("button", { name: "Desfazer" })).toBeDisabled();
    await showAnswer();
    await userEvent.click(answerButton("Fácil"));
    await waitFor(() => expect(screen.getByTestId("card-content")).toHaveTextContent(/^dog$/));
    await userEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(screen.getByTestId("card-content")).toHaveTextContent(/^cat$/));
    await waitFor(async () =>
      expect((await rt.db.reviewLogs.toArray())[0]?.undoneAt).toBe(NOW + 2),
    );
    expect((await rt.db.cards.get(c.id))?.queue).toBe("new");
    expect(screen.getByRole("button", { name: "Desfazer" })).toBeDisabled();
  });

  async function moreActions() {
    await userEvent.click(screen.getByRole("button", { name: "Mais ações" }));
    return screen.getByRole("dialog", { name: "Mais ações" });
  }

  it("buries the card until tomorrow, and can undo it", async () => {
    const { card: c } = await addNote("cat", "gato");
    renderWithRouter(<StudyScreen deckId={deck.id} />);
    await card();
    await userEvent.click(within(await moreActions()).getByRole("button", { name: "Enterrar" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Cartão enterrado até amanhã.");
    await screen.findByText("Tudo em dia! Nada mais para estudar neste baralho hoje.");
    await waitFor(async () => expect((await rt.db.cards.get(c.id))?.queue).toBe("buried"));
    await userEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(screen.getByTestId("card-content")).toHaveTextContent("cat"));
    await waitFor(async () => expect((await rt.db.cards.get(c.id))?.queue).toBe("new"));
  });

  it("suspends the card", async () => {
    const { card: c } = await addNote("cat", "gato");
    renderWithRouter(<StudyScreen deckId={deck.id} />);
    await card();
    await userEvent.click(within(await moreActions()).getByRole("button", { name: "Suspender" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Cartão suspenso.");
    await waitFor(async () => expect((await rt.db.cards.get(c.id))?.queue).toBe("suspended"));
  });

  it("flags the card and links to editing its note", async () => {
    const { note, card: c } = await addNote("cat", "gato");
    renderWithRouter(<StudyScreen deckId={deck.id} />);
    await card();
    const sheet = await moreActions();
    expect(within(sheet).getByRole("link", { name: "Editar nota" })).toHaveAttribute(
      "href",
      `/notes/${note.id}/edit`,
    );
    await userEvent.click(within(sheet).getByRole("button", { name: "Marcar: Laranja" }));
    await waitFor(async () => expect((await rt.db.cards.get(c.id))?.flag).toBe(2));
    expect(screen.getByTestId("card-content")).toHaveTextContent("cat");
  });

  it("warns about a leech", async () => {
    await rt.repos.presets.update(SEED_IDS.preset, { leechThreshold: 1, leechAction: "tag" });
    const { note, card: c } = await addNote("cat", "gato");
    await rt.db.cards.update(c.id, {
      queue: "review",
      state: "review",
      due: NOW - DAY,
      stability: 5,
      difficulty: 5,
      reps: 3,
      scheduledDays: 5,
      lastReviewAt: NOW - 6 * DAY,
    });
    renderWithRouter(<StudyScreen deckId={deck.id} />);
    await card();
    await showAnswer();
    await userEvent.click(answerButton("De novo"));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Cartão problemático: recebeu a etiqueta leech.",
    );
    await waitFor(async () => expect((await rt.db.notes.get(note.id))?.tags).toEqual(["leech"]));
  });

  it("vibrates briefly on each answer unless haptics are off", async () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    await addNote("cat", "gato");
    await addNote("dog", "cão");
    renderWithRouter(<StudyScreen deckId={deck.id} />);
    await card();
    await showAnswer();
    await userEvent.click(answerButton("Fácil"));
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it("does not vibrate when haptics are off", async () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    await rt.repos.settings.set("haptics", false);
    await addNote("cat", "gato");
    renderWithRouter(<StudyScreen deckId={deck.id} />);
    await card();
    await showAnswer();
    await userEvent.click(answerButton("Fácil"));
    await screen.findByText("Tudo em dia! Nada mais para estudar neste baralho hoje.");
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("records how long the answer took, capped at one minute", async () => {
    await addNote("cat", "gato");
    renderWithRouter(<StudyScreen deckId={deck.id} />);
    await card();
    rt.clock.advance(90_000);
    await showAnswer();
    await userEvent.click(answerButton("Fácil"));
    await waitFor(async () =>
      expect((await rt.db.reviewLogs.toArray())[0]?.durationMs).toBe(60_000),
    );
  });

  it("shows the timer when the preset asks for it", async () => {
    await rt.repos.presets.update(SEED_IDS.preset, { showTimer: true });
    await addNote("cat", "gato");
    renderWithRouter(<StudyScreen deckId={deck.id} />);
    expect(await screen.findByRole("timer", { name: "Tempo" })).toHaveTextContent("0:00");
  });

  it("tells when the next learning card comes due", async () => {
    const { card: c } = await addNote("cat", "gato");
    await rt.db.cards.update(c.id, {
      queue: "learning",
      state: "learning",
      reps: 1,
      due: NOW + 45 * 60_000,
    });
    renderWithRouter(<StudyScreen deckId={deck.id} />);
    expect(await screen.findByText("Próximo cartão em aprendizado em 25 min.")).toBeInTheDocument();
  });

  it("releases yesterday's burials when the session starts", async () => {
    const { card: c } = await addNote("cat", "gato");
    await rt.db.cards.update(c.id, { queue: "buried", buriedUntilDay: "2026-11-16" });
    renderWithRouter(<StudyScreen deckId={deck.id} />);
    expect(await card()).toHaveTextContent("cat");
  });

  it("says so when the deck does not exist", async () => {
    renderWithRouter(<StudyScreen deckId="00000000-0000-7000-8000-000000000999" />);
    expect(await screen.findByText("Esse baralho não existe mais.")).toBeInTheDocument();
  });

  describe("custom study", () => {
    it("reviews today's forgotten cards, even past the daily limits", async () => {
      await rt.repos.presets.update(SEED_IDS.preset, { newPerDay: 0 });
      const { card: forgotten } = await addNote("cat", "gato");
      await addNote("dog", "cão");
      await rt.db.reviewLogs.add(
        makeReviewLog({ cardId: forgotten.id, rating: 1, reviewedAt: NOW - 60_000 }),
      );
      renderWithRouter(<StudyScreen deckId={deck.id} custom={{ kind: "forgotten" }} />);
      expect(await screen.findByText("Esquecidos hoje")).toBeInTheDocument();
      expect(await card()).toHaveTextContent(/^cat$/);
      await showAnswer();
      await userEvent.click(answerButton("Fácil"));
      expect(
        await screen.findByText("Pronto! Você terminou este estudo personalizado."),
      ).toBeInTheDocument();
    });

    it("studies the cards of a tag", async () => {
      const { note } = await addNote("cat", "gato");
      await rt.db.notes.update(note.id, { tags: ["animais"] });
      await addNote("dog", "cão");
      renderWithRouter(<StudyScreen deckId={deck.id} custom={{ kind: "tag", tag: "animais" }} />);
      expect(await screen.findByText("Etiqueta: animais")).toBeInTheDocument();
      expect(await screen.findByText("1 novo, 0 aprendendo, 0 para revisar")).toBeInTheDocument();
    });

    it("reviews ahead of time", async () => {
      const { card: c } = await addNote("cat", "gato");
      await rt.db.cards.update(c.id, {
        queue: "review",
        state: "review",
        reps: 2,
        stability: 5,
        difficulty: 5,
        scheduledDays: 5,
        due: NOW + 2 * DAY,
        lastReviewAt: NOW - 3 * DAY,
      });
      renderWithRouter(<StudyScreen deckId={deck.id} custom={{ kind: "ahead", days: 3 }} />);
      expect(await screen.findByText("Adiantar 3 dias")).toBeInTheDocument();
      expect(await card()).toHaveTextContent("cat");
    });

    it("says so when nothing matches", async () => {
      renderWithRouter(<StudyScreen deckId={deck.id} custom={{ kind: "forgotten" }} />);
      expect(
        await screen.findByText("Pronto! Você terminou este estudo personalizado."),
      ).toBeInTheDocument();
    });
  });
});
