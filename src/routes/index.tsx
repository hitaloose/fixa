import { createFileRoute } from "@tanstack/react-router";
import { BackupReminder } from "../features/backup";
import { DeckListScreen } from "../features/decks";
import { Brand } from "../ui";

export const Route = createFileRoute("/")({
  component: function Home() {
    return (
      <>
        <Brand />
        <BackupReminder />
        <DeckListScreen />
      </>
    );
  },
});
