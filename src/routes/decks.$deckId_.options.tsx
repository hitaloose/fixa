import { createFileRoute } from "@tanstack/react-router";
import { DeckOptionsScreen } from "../features/options";

export const Route = createFileRoute("/decks/$deckId_/options")({
  component: function DeckOptionsRoute() {
    const { deckId } = Route.useParams();
    return <DeckOptionsScreen deckId={deckId} />;
  },
});
