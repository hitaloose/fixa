import { createFileRoute } from "@tanstack/react-router";
import { t } from "../i18n/pt-BR";

export const Route = createFileRoute("/browse")({
  component: () => <h1 className="pt-6 font-display text-[32px] font-bold">{t.nav.browse}</h1>,
});
