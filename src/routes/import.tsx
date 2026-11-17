import { createFileRoute } from "@tanstack/react-router";
import { ImportScreen } from "../features/import";
import { readAnkiPackage } from "../workers/importClient";

export const Route = createFileRoute("/import")({
  component: () => <ImportScreen readPackage={readAnkiPackage} />,
});
