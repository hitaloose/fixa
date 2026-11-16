import { createFileRoute } from "@tanstack/react-router";
import { DeckListScreen } from "../features/decks";

export const Route = createFileRoute("/")({ component: DeckListScreen });
