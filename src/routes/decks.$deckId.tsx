import { createFileRoute } from "@tanstack/react-router";
import { DeckOverviewScreen } from "../features/decks";

export const Route = createFileRoute("/decks/$deckId")({
  component: function DeckOverviewRoute() {
    const { deckId } = Route.useParams();
    return <DeckOverviewScreen deckId={deckId} />;
  },
});
