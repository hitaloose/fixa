import { useRegisterSW } from "virtual:pwa-register/react";
import { t } from "../i18n/pt-BR";
import { Button } from "../ui";

/** Shown when a new service worker is waiting (registerType: "prompt"). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(var(--spacing-tabbar)+12px)] z-10 mx-auto flex max-w-xl items-center gap-2 rounded-list bg-ink p-3 text-surface"
    >
      <span className="flex-1 text-sm">{t.pwa.updateAvailable}</span>
      <Button variant="ghost" className="text-surface" onClick={() => setNeedRefresh(false)}>
        {t.pwa.dismiss}
      </Button>
      <Button onClick={() => void updateServiceWorker(true)}>{t.pwa.update}</Button>
    </div>
  );
}
