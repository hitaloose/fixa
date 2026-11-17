import { createFileRoute } from "@tanstack/react-router";
import { StudyScreen } from "../features/study";

export const Route = createFileRoute("/decks/$deckId_/study")({
  component: function StudyRoute() {
    const { deckId } = Route.useParams();
    return <StudyScreen deckId={deckId} />;
  },
});
