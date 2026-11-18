import { createFileRoute, Link } from "@tanstack/react-router";
import { BackupReminder } from "../features/backup";
import { DeckListScreen } from "../features/decks";
import { t } from "../i18n";
import { Brand, Icon } from "../ui";
import { writeAnkiPackage } from "../workers/importClient";

export const Route = createFileRoute("/")({
  component: function Home() {
    return (
      <>
        <Brand
          action={
            <Link
              to="/settings"
              aria-label={t.settings.open}
              className="inline-flex size-11 items-center justify-center rounded-button text-ink"
            >
              <Icon name="settings" />
            </Link>
          }
        />
        <BackupReminder />
        <DeckListScreen writeAnkiPackage={writeAnkiPackage} />
      </>
    );
  },
});
