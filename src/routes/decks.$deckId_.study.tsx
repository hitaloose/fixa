import { createFileRoute } from "@tanstack/react-router";
import { type CustomStudy, StudyScreen } from "../features/study";

interface StudySearch {
  custom?: "forgotten" | "tag" | "ahead" | "infinite";
  tag?: string;
  days?: number;
}

function toCustom(search: StudySearch): CustomStudy | undefined {
  if (search.custom === "forgotten") return { kind: "forgotten" };
  if (search.custom === "tag" && search.tag) return { kind: "tag", tag: search.tag };
  if (search.custom === "ahead") return { kind: "ahead", days: Math.max(1, search.days ?? 1) };
  if (search.custom === "infinite") return { kind: "infinite" };
  return undefined;
}

export const Route = createFileRoute("/decks/$deckId_/study")({
  validateSearch: (search: Record<string, unknown>): StudySearch => ({
    ...(search.custom === "forgotten" ||
    search.custom === "tag" ||
    search.custom === "ahead" ||
    search.custom === "infinite"
      ? { custom: search.custom }
      : {}),
    ...(typeof search.tag === "string" ? { tag: search.tag } : {}),
    ...(typeof search.days === "number" && Number.isInteger(search.days)
      ? { days: search.days }
      : {}),
  }),
  component: function StudyRoute() {
    const { deckId } = Route.useParams();
    const custom = toCustom(Route.useSearch());
    return <StudyScreen deckId={deckId} {...(custom ? { custom } : {})} />;
  },
});
