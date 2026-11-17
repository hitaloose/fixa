import type { ReactNode } from "react";
import { t } from "../../i18n/pt-BR";

/** Logo + wordmark at the top of the home screen (docs/09 › Marca), with an optional action. */
export function Brand({ action }: { action?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-4">
      <img
        src={`${import.meta.env.BASE_URL}favicon.svg`}
        alt={t.app.name}
        width={32}
        height={32}
        className="size-8 rounded-lg"
      />
      <span aria-hidden="true" className="flex-1 font-display text-xl font-bold tracking-tight">
        {t.app.name}
      </span>
      {action}
    </div>
  );
}
