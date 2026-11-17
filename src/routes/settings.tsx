import { createFileRoute } from "@tanstack/react-router";
import { SettingsScreen } from "../features/backup";

export const Route = createFileRoute("/settings")({
  component: () => <SettingsScreen appVersion={__APP_VERSION__} />,
});
