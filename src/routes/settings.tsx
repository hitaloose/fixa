import { createFileRoute } from "@tanstack/react-router";
import { SettingsScreen } from "../features/backup";
import { writeAnkiPackage } from "../workers/importClient";

export const Route = createFileRoute("/settings")({
  component: () => (
    <SettingsScreen appVersion={__APP_VERSION__} writeAnkiPackage={writeAnkiPackage} />
  ),
});
