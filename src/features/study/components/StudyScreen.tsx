import { Link } from "@tanstack/react-router";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { runtime } from "../../../data/runtime";
import type { QueueCounts } from "../../../domain/queue";
import { previewIntervals, type Rating } from "../../../domain/scheduler";
import { renderCard } from "../../../domain/templates";
import { t } from "../../../i18n/pt-BR";
import { formatInterval } from "../../../lib/format";
import { Button, CardView, Icon, IconButton, Sheet, Toast } from "../../../ui";
import { useMediaResolver } from "../hooks/useMediaResolver";
import { type StudyCard, type StudySession, useStudySession } from "../hooks/useStudySession";

const RATINGS: Rating[] = [1, 2, 3, 4];
const RATING_STYLE: Record<Rating, string> = {
  1: "bg-again-bg text-again-ink",
  2: "bg-hard-bg text-hard-ink",
  3: "bg-good-bg text-good-ink",
  4: "bg-easy-bg text-easy-ink",
};
const SWIPE_PX = 80;

function BackLink({ deckId }: { deckId: string }) {
  return (
    <Link
      to="/decks/$deckId"
      params={{ deckId }}
      aria-label={t.study.back}
      className="inline-flex size-11 items-center justify-center rounded-button text-ink"
    >
      <Icon name="chevronRight" className="size-6 rotate-180" />
    </Link>
  );
}

function Counts({ counts, current }: { counts: QueueCounts; current: StudyCard | null }) {
  const kind = current
    ? current.card.queue === "new"
      ? "new"
      : current.card.queue === "review"
        ? "review"
        : "learning"
    : null;
  const style = { new: "text-new", learning: "text-learning", review: "text-review" } as const;
  return (
    <p className="flex items-center gap-3 font-display text-lg font-bold tabular-nums">
      <span className="sr-only">{t.decks.counts(counts)}</span>
      {(["new", "learning", "review"] as const).map((k) => (
        <span
          key={k}
          aria-hidden="true"
          className={`${style[k]} ${kind === k ? "underline decoration-2 underline-offset-4" : ""}`}
        >
          {counts[k]}
        </span>
      ))}
    </p>
  );
}

function Timer({ since }: { since: number }) {
  const [now, setNow] = useState(() => runtime().clock.now());
  useEffect(() => {
    const id = setInterval(() => setNow(runtime().clock.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  return (
    <span role="timer" aria-label={t.study.timer} className="text-sm tabular-nums text-muted">
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
    </span>
  );
}

function MoreActions({
  open,
  onOpenChange,
  session,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: StudySession;
  current: StudyCard;
}) {
  const close = (action: () => void) => () => {
    onOpenChange(false);
    action();
  };
  const row = "flex min-h-11 w-full items-center px-1 text-left font-medium";
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t.study.more} closeLabel={t.common.close}>
      <div className="flex flex-col divide-y divide-line-soft">
        <Link to="/notes/$noteId/edit" params={{ noteId: current.card.noteId }} className={row}>
          {t.study.edit}
        </Link>
        <button type="button" className={row} onClick={close(session.bury)}>
          {t.study.bury}
        </button>
        <button type="button" className={row} onClick={close(session.suspend)}>
          {t.study.suspend}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {t.study.flags.map((color, i) => (
          <button
            key={color}
            type="button"
            aria-pressed={current.card.flag === i + 1}
            onClick={close(() => session.flag(i + 1))}
            className="min-h-11 rounded-chip border border-line px-3 text-sm aria-pressed:border-primary aria-pressed:text-primary"
          >
            {t.study.flag(color)}
          </button>
        ))}
        {current.card.flag > 0 ? (
          <button
            type="button"
            onClick={close(() => session.flag(0))}
            className="min-h-11 rounded-chip px-3 text-sm text-muted"
          >
            {t.study.unflag}
          </button>
        ) : null}
      </div>
    </Sheet>
  );
}

function Answers({ current, onAnswer }: { current: StudyCard; onAnswer: (r: Rating) => void }) {
  const now = runtime().clock.now();
  const preview = previewIntervals(current.card, now, current.preset);
  const ms: Record<Rating, number> = {
    1: preview.again,
    2: preview.hard,
    3: preview.good,
    4: preview.easy,
  };
  return (
    <div className="grid grid-cols-4 gap-2">
      {RATINGS.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onAnswer(r)}
          className={`flex min-h-14 flex-col items-center justify-center rounded-field px-1 font-semibold ${RATING_STYLE[r]}`}
        >
          <span>{t.study.ratings[r]}</span>
          <span className="text-xs font-normal"> {formatInterval(ms[r], t.interval)}</span>
        </button>
      ))}
    </div>
  );
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export function StudyScreen({ deckId }: { deckId: string }) {
  const session = useStudySession(deckId);
  const media = useMediaResolver();
  const [moreOpen, setMoreOpen] = useState(false);
  const swipeStart = useRef<number | null>(null);
  const live = useRef({ session, moreOpen });
  live.current = { session, moreOpen };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { session: s, moreOpen: sheetOpen } = live.current;
      if (sheetOpen || isTyping(e.target) || !s.current) return;
      if (!s.revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        s.reveal();
      } else if (s.revealed && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        s.answer(Number(e.key) as Rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (session.status === "loading") return null;
  if (session.status === "not-found") {
    return (
      <div className="flex flex-col gap-4 pt-4">
        <p className="text-muted">{t.study.notFound}</p>
      </div>
    );
  }

  const { current } = session;
  const onPointerDown = (e: PointerEvent) => {
    swipeStart.current = e.clientX;
  };
  const onPointerUp = (e: PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (start === null || !session.revealed) return;
    const dx = e.clientX - start;
    if (dx <= -SWIPE_PX) session.answer(1);
    else if (dx >= SWIPE_PX) session.answer(3);
  };

  let html = "";
  if (current?.noteType && current.note) {
    const sides = renderCard({
      noteType: current.noteType,
      note: current.note,
      templateOrd: current.card.templateOrd,
    });
    html = session.revealed ? sides.back : sides.front;
  }

  return (
    <div className="flex min-h-[calc(100dvh-var(--spacing-tabbar))] flex-col gap-3 pt-2 pb-4">
      <header className="flex items-center justify-between gap-2">
        {/* When the deck is done, the message below carries the way back. */}
        {current ? <BackLink deckId={deckId} /> : <span className="size-11" />}
        <Counts counts={session.counts} current={current} />
        <div className="flex items-center">
          {current?.preset.showTimer ? (
            <Timer key={session.shownAt} since={session.shownAt} />
          ) : null}
          <IconButton
            icon="undo"
            label={t.study.undo}
            disabled={!session.canUndo}
            onClick={session.undo}
            className="disabled:opacity-40"
          />
          {current ? (
            <IconButton icon="more" label={t.study.more} onClick={() => setMoreOpen(true)} />
          ) : null}
        </div>
      </header>

      {current ? (
        <>
          <section
            data-testid="study-card"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            className="flex-1 touch-pan-y overflow-y-auto rounded-section border border-line bg-surface p-5 text-center text-xl"
          >
            <CardView
              key={`${current.card.id}:${session.revealed}`}
              html={html}
              css={current.noteType?.css ?? ""}
              resolveMedia={media}
              autoplay={current.preset.autoplayAudio}
            />
          </section>
          {session.revealed ? (
            <Answers current={current} onAnswer={session.answer} />
          ) : (
            <Button onClick={session.reveal} className="min-h-14 bg-ink text-surface">
              {t.study.showAnswer}
            </Button>
          )}
          {moreOpen ? (
            <MoreActions open onOpenChange={setMoreOpen} session={session} current={current} />
          ) : null}
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-lg font-semibold">
            {session.waitUntil !== null
              ? t.study.waiting(
                  formatInterval(session.waitUntil - runtime().clock.now(), t.interval),
                )
              : t.study.done}
          </p>
          <Link
            to="/decks/$deckId"
            params={{ deckId }}
            className="inline-flex min-h-11 items-center font-semibold text-primary"
          >
            {t.study.back}
          </Link>
        </div>
      )}

      {session.toast ? <Toast message={session.toast} onDismiss={session.dismissToast} /> : null}
    </div>
  );
}
