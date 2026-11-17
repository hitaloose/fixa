import { createFileRoute } from "@tanstack/react-router";
import { BackupReminder } from "../features/backup";
import { DeckListScreen } from "../features/decks";

export const Route = createFileRoute("/")({
  component: function Home() {
    return (
      <>
        <BackupReminder />
        <DeckListScreen />
      </>
    );
  },
});
