import { createFileRoute } from "@tanstack/react-router";
import { AddNoteScreen } from "../features/editor";

interface AddSearch {
  deckId?: string;
}

export const Route = createFileRoute("/add")({
  validateSearch: (search: Record<string, unknown>): AddSearch =>
    typeof search.deckId === "string" ? { deckId: search.deckId } : {},
  component: function AddRoute() {
    const { deckId } = Route.useSearch();
    return <AddNoteScreen {...(deckId ? { deckId } : {})} />;
  },
});
